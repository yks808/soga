const express = require("express");
const router = express.Router();
const pool = require("../db");
const authenticateToken = require("../middleware/auth");

// Get all posts
router.get("/", async (req, res) => {
  try {
    const posts = await pool.query(
      "SELECT posts.*, users.username, users.profile_photo FROM posts JOIN users ON posts.user_id = users.id ORDER BY posts.created_at DESC",
    );
    res.json(posts.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//Get a single post
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const post = await pool.query(
      "SELECT posts.*, users.username, users.profile_photo FROM posts JOIN users ON posts.user_id = users.id WHERE posts.id = $1",
      [id],
    );
    if (post.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }
    res.json(post.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//create a new post
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
    res.status(201).json(newPost.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//Delete POST

router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const post = await pool.query("SELECT * FROM posts WHERE id = $1", [id]);

    if (post.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (post.rows[0].user_id !== req.user.id) {
      return res.status(403).json({
        error: "Not authorized to delete this post",
      });
    }
    await pool.query("DELETE FROM posts WHERE id = $1", [id]);
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;
