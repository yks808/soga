const express = require("express");
const router = express.Router();
const pool = require("../db");
const authenticateToken = require("../middleware/auth");

// GET comments on a post
router.get("/:postId/comments", async (req, res) => {
  try {
    const { postId } = req.params;

    const comments = await pool.query(
      "SELECT * FROM comments WHERE post_id = $1",
      [postId],
    );

    if (comments.rows.length === 0) {
      return res.json({ message: "No comments yet" });
    }
    res.json(comments.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE(POST) your comments on a post
router.post("/:postId/comments", authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { parent_id, content, external_link } = req.body;
    const newComment = await pool.query(
      "INSERT INTO comments (user_id, post_id, parent_id, content, external_link) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [req.user.id, postId, parent_id, content, external_link],
    );
    res.status(201).json(newComment.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE your comment on a post
router.delete(
  "/:postId/comments/:commentId",
  authenticateToken,
  async (req, res) => {
    try {
      const { postId, commentId } = req.params;
      const comment = await pool.query(
        "SELECT * FROM comments WHERE id = $1 AND post_id = $2",
        [commentId, postId],
      );

      if (comment.rows.length === 0) {
        return res.status(404).json({ error: "Comment not found" });
      }

      if (comment.rows[0].user_id !== req.user.id) {
        return res
          .status(403)
          .json({ error: "Not authorized to delete comments" });
      }
      await pool.query("UPDATE comments SET is_deleted = true WHERE id = $1", [
        commentId,
      ]);
      res.json({ message: "Comment deleted successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// HYDE(PUT since it is update) others comment on your post
// router.put("/:postId/comments/:commentId/hide");

module.exports = router;
