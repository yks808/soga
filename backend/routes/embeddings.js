const express = require("express");
const router = express.Router();
const pool = require("../db");
const authenticateToken = require("../middleware/auth");
const generateEmbedding = requie("../utils/embeddings");

// Add embedding info of the post to database
router.post("/generate/:postId", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await pool.query("SELECT * FROM posts WHERE id = $1", [
      postId,
    ]);

    if (post.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    const textToEmbed = [
      post.rows[0].description,
      post.rows[0].category,
      post.rows[0].disability_type,
      post.rows[0].country_origin,
    ]
      .filter(Boolean)
      .join(" ");

    const embedding = await generateEmbedding(textToEmbed);

    await pool.query("UPDATE posts SET embedding = $1 WHERE id = $2", [
      `[${embedding.join(",")}]`,
      postId,
    ]);

    res.json({ message: "Embedding generated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET top five similar posts and the username of the post - not including itself
router.get("/similar/:postId", async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await pool.query("SELECT embedding FROM posts WHERE id = $1", [
      postId,
    ]);

    if (post.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (!post.rows[0].embedding) {
      return res.status(400).json({ error: "Post has no embedding yet" });
    }

    const similarPosts = await pool.query(
      `SELECT posts.*, users.username,
        1 - (embedding <=> $1) as similarity
       FROM posts
       JOIN users ON posts.user_id = users.id
       WHERE posts.id != $2
       AND embedding IS NOT NULL
       ORDER BY similarity DESC
       LIMIT 5`,
      [post.rows[0].embedding, postId],
    );

    res.json(similarPosts.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
