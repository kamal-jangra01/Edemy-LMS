import { clerkClient } from "@clerk/express";

// middleware - protects educator routes
export const protectEducator = async (req, res, next) => {
  try {
    const { userId } = req.auth(); // ✅ FIX

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const response = await clerkClient.users.getUser(userId);

    if (response.publicMetadata.role !== "educator") {
      return res.json({ success: false, message: "unauthorized access" });
    }

    next();
  } catch (error) {
    console.log("MIDDLEWARE ERROR:", error.message);
    res.json({ success: false, message: error.message });
  }
};
