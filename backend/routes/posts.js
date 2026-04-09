const express = require("express");
const router = express.Router();
const pool = require("../db");
const authenticateToken = require("../middleware/auth");
const redisClient = require("../redis");
const generateEmbedding = require("../utils/embeddings");

// GET all using redis
router.get("/", async (req, res) => {
  try {
    const cached = await redisClient.get("all_posts");

    if (cached) {
      console.log("Feed from CACHE");
      return res.json(JSON.parse(cached));
    }

    console.log("Feed from POSTGRES");
    const posts = await pool.query(
      "SELECT posts.*, users.username, users.profile_photo FROM posts JOIN users ON posts.user_id = users.id ORDER BY posts.created_at DESC",
    );

    await redisClient.setEx("all_posts", 30, JSON.stringify(posts.rows));

    res.json(posts.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all of your posts
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const id = req.user.id;

    const allPosts = await pool.query(
      "SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC",
      [id],
    );

    if (allPosts.rows.length === 0) {
      return res.json({ message: "No posts created yet" });
    }

    res.json(allPosts.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//GET all of someone's post
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await pool.query("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);

    if (user.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const post = await pool.query(
      "SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC",
      [userId],
    );

    if (post.rows.length === 0) {
      return res.json({ message: "This user has no posts yet" });
    }
    res.json(post.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE(POST) a new post
router.post("/", authenticateToken, async (req, res) => {
  try {
    const {
      description,
      image_url,
      video_url,
      external_link,
      country_origin,
      category,
      disability_type,
      post_type,
    } = req.body;

    if (!image_url && !video_url) {
      return res
        .status(400)
        .json({ error: "Post must contain either an image or a video." });
    }

    if (image_url && video_url) {
      return res
        .status(400)
        .json({ error: "Please choose either an image or a video." });
    }

    const newPost = await pool.query(
      "INSERT INTO posts (user_id, description, image_url, video_url, external_link, country_origin, category, disability_type, post_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
      [
        req.user.id,
        description,
        image_url,
        video_url,
        external_link,
        country_origin,
        category,
        disability_type,
        post_type || "discovery",
      ],
    );
    // create embedding and insert in database
    const textToEmbed = [
      newPost.rows[0].description,
      newPost.rows[0].category,
      newPost.rows[0].disability_type,
      newPost.rows[0].country_origin,
    ]
      .filter(Boolean)
      .join(" ");

    const embedding = await generateEmbedding(textToEmbed);

    await pool.query("UPDATE posts SET embedding = $1 WHERE id = $2", [
      `[${embedding.join(",")}]`,
      newPost.rows[0].id,
    ]);

    res.status(201).json(newPost.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a post using post id
router.delete("/:postId", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await pool.query("SELECT * FROM posts WHERE id = $1", [
      postId,
    ]);

    if (post.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (post.rows[0].user_id !== req.user.id) {
      return res.status(403).json({
        error: "Not authorized to delete this post",
      });
    }
    await pool.query("DELETE FROM posts WHERE id = $1", [postId]);

    await redisClient.del(`post:${postId}`);
    console.log(`Cache cleared for post:${postId}`);

    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// GET posts by category
router.get("/category/:category", async (req, res) => {
  try {
    const { category } = req.params;
    const posts = await pool.query(
      "SELECT posts.* FROM posts WHERE category = $1 ORDER BY posts.created_at DESC",
      [category],
    );
    if (posts.rows.length === 0) {
      return res.json({ message: "No posts found for this category" });
    }
    res.json(posts.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET posts by country
router.get("/country/:country_origin", async (req, res) => {
  try {
    const { country_origin } = req.params;
    const posts = await pool.query(
      "SELECT posts.* FROM posts WHERE country_origin = $1 ORDER BY posts.created_at DESC",
      [country_origin],
    );
    if (posts.rows.length === 0) {
      return res.json({ message: "No posts found for this country" });
    }
    res.json(posts.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET posts by disability type
router.get("/for/:disability_type", async (req, res) => {
  try {
    const { disability_type } = req.params;
    const posts = await pool.query(
      "SELECT posts.* FROM posts WHERE disability_type = $1 ORDER BY posts.created_at DESC",
      [disability_type],
    );
    if (posts.rows.length === 0) {
      return res.json({ message: "No posts found for this disability type" });
    }
    res.json(posts.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET posts by post type
router.get("/type/:post_type", async (req, res) => {
  try {
    const { post_type } = req.params;
    const posts = await pool.query(
      "SELECT posts.* FROM posts WHERE post_type = $1 ORDER BY posts.created_at DESC",
      [post_type],
    );
    if (posts.rows.length === 0) {
      return res.json({ message: "No posts found for post type" });
    }
    res.json(posts.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE(PUT) a post you have created
router.put("/:postId", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const {
      description,
      image_url,
      video_url,
      external_link,
      country_origin,
      category,
      disability_type,
      post_type,
    } = req.body;

    const post = await pool.query("SELECT * FROM posts WHERE id = $1", [
      postId,
    ]);

    if (post.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (post.rows[0].user_id !== req.user.id) {
      return res.status(403).json({
        error: "Not authorized to edit this post",
      });
    }

    const edittedPost = await pool.query(
      "UPDATE posts SET description = $1, image_url = $2, video_url = $3, external_link = $4, country_origin = $5, category = $6, disability_type = $7, post_type = $8 WHERE id = $9 RETURNING *",
      [
        description || post.rows[0].description,
        image_url || post.rows[0].image_url,
        video_url || post.rows[0].video_url,
        external_link || post.rows[0].external_link,
        country_origin || post.rows[0].country_origin,
        category || post.rows[0].category,
        disability_type || post.rows[0].disability_type,
        post_type || post.rows[0].post_type,
        postId,
      ],
    );
    const textToEmbed = [
      edittedPost.rows[0].description,
      edittedPost.rows[0].category,
      edittedPost.rows[0].disability_type,
      edittedPost.rows[0].country_origin,
    ]
      .filter(Boolean)
      .join(" ");

    const embedding = await generateEmbedding(textToEmbed);

    await pool.query("UPDATE posts SET embedding = $1 WHERE id = $2", [
      `[${embedding.join(",")}]`,
      postId,
    ]);

    await redisClient.del(`post:${postId}`);
    console.log(`Cache cleared for post:${postId} only!`);

    res.json(edittedPost.rows[0]);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// GET a single post by using post id
router.get("/:postId", async (req, res) => {
  try {
    const { postId } = req.params;

    const cachedPost = await redisClient.get(`post:${postId}`);

    if (cachedPost) {
      console.log(`post ${postId} from CACHE`);
      return res.json(JSON.parse(cachedPost));
    }

    const post = await pool.query(
      "SELECT posts.*, users.username, users.profile_photo FROM posts JOIN users ON posts.user_id = users.id WHERE posts.id = $1",
      [postId],
    );

    if (post.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    await redisClient.set(`post:${postId}`, 300, JSON.stringify(post.rows[0]));
    console.log(`Post ${postId} saved to CACHE`);

    res.json(post.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
