import mongoose from "mongoose";
import User from "../Models/userModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import validator from "validator";
import cloudinary from "../utils/cloudinary.js";
import { PassThrough } from "stream";
import Post from "../Models/postModel.js";
import Notification from "../Models/notificationModel.js";
import Chat from "../Models/chatModel.js";
import Follow from "../Models/followModel.js";

const createToken = (_id) => {
  return jwt.sign({ _id }, process.env.JWT_SECRET, { expiresIn: "3d" });
};

export const registerUser = async (req, res) => {
  const { name, email, password, phone_number } = req.body;
  const profile_image = req.files?.profile_image?.[0];

  try {
    if (!name || !email || !password || !phone_number) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: "Invalid email" });
    }
    if (!validator.isStrongPassword(password, { minSymbols: 0 })) {
      return res.status(400).json({ message: "Password must be strong" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    let profileImageUrl = null;
    if (profile_image) {
      profileImageUrl = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "profile_images",
            public_id: `${Date.now()}-${profile_image.originalname}`,
            resource_type: "image",
          },
          (error, result) => {
            if (error) {
              return reject(new Error(`Cloudinary upload failed: ${error.message}`));
            }
            resolve(result.secure_url);
          }
        );

        const bufferStream = new PassThrough();
        bufferStream.end(profile_image.buffer);
        bufferStream.pipe(uploadStream);

        bufferStream.on("error", (error) => {
          reject(error);
        });
      });

      if (!profileImageUrl) {
        throw new Error("Failed to obtain profile image URL from Cloudinary");
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashed_password = await bcrypt.hash(password, salt);
    const user = new User({
      name,
      email,
      hashed_password,
      phone_number,
      profile_image: profileImageUrl,
      bio: "",
      followers: [],
      following: [],
    });
    await user.save();

    const token = createToken(user._id);
    res.status(201).json({
      token,
      user: {
        _id: user._id,
        name,
        email,
        phone_number,
        profile_image: user.profile_image,
        bio: user.bio,
        followers: [],
        following: [],
      },
    });
  } catch (error) {
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.hashed_password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = createToken(user._id);
    res.status(200).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone_number: user.phone_number,
        profile_image: user.profile_image,
        bio: user.bio,
        followers: user.followers,
        following: user.following,
      },
    });
  } catch (error) {
    res.status(500).json({ message: `Server error during login: ${error.message}` });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-hashed_password -resetToken -resetTokenExpires")
      .populate("followers", "name profile_image")
      .populate("following", "name profile_image");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
};

export const requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetToken = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    user.resetToken = resetToken;
    user.resetTokenExpires = Date.now() + 3600000;
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/change-password?token=${resetToken}`;
    const html = `
      <p>You requested a password reset. Click the link below to reset your password:</p>
      <a href="${resetUrl}"><button style="padding: 10px 20px; background-color: #A5CCFF; color: white; border: none; border-radius: 5px;">Reset Password</button></a>
      <p>This link will expire in 1 hour.</p>
    `;
    await sendEmail(email, "Password Reset Request", html);
    res.status(200).json({ message: "Password reset email sent" });
  } catch (error) {
    res.status(500).json({ message: `Server error during password reset request: ${error.message}` });
  }
};

export const changePassword = async (req, res) => {
  const { password, token } = req.body;

  try {
    if (!password || !token) {
      return res.status(400).json({ message: "Password and token are required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const user = await User.findById(decoded._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.resetToken !== token || user.resetTokenExpires < Date.now()) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    if (!validator.isStrongPassword(password, { minSymbols: 0 })) {
      return res.status(400).json({ message: "Password must be strong" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed_password = await bcrypt.hash(password, salt);
    user.hashed_password = hashed_password;
    user.resetToken = null;
    user.resetTokenExpires = null;
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    res.status(500).json({ message: `Server error during password reset: ${error.message}` });
  }
};

export const searchUsers = async (req, res) => {
  const { query } = req.query;
  try {
    let users;
    if (!query) {
      // Return all users (except current user) in random order
      users = await User.aggregate([
        { $match: { _id: { $ne: new mongoose.Types.ObjectId(req.user._id) } } },
        { $sample: { size: 20 } }, // Randomize and limit to 20 users
        {
          $project: {
            name: 1,
            profile_image: 1,
            followers: 1,
            following: 1,
          },
        },
      ]);
    } else {
      // Existing search logic for non-empty query
      users = await User.find({
        name: { $regex: query, $options: "i" },
        _id: { $ne: req.user._id },
      })
        .select("name profile_image followers following")
        .limit(20);
    }

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
};

export const getUserProfile = async (req, res) => {
  const { userId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const posts = await Post.find({ user_id: userId })
      .sort({ createdAt: -1 })
      .populate("user_id", "name profile_image")
      .populate("comments.user_id", "name profile_image");

    res.status(200).json({
      user,
      postCount: posts.length,
      posts,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
};

export const followUser = async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user._id.toString();

  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (userId === currentUserId) {
      return res.status(400).json({ message: "Cannot follow yourself" });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ message: "Current user not found" });
    }

    const existingFollow = await Follow.findOne({
      followerId: currentUserId,
      followeeId: userId,
    });
    const isFollowing = !!existingFollow;

    if (isFollowing) {
      // Unfollow
      await Follow.deleteOne({ followerId: currentUserId, followeeId: userId });
      currentUser.following = currentUser.following.filter(
        (id) => id.toString() !== userId
      );
      targetUser.followers = targetUser.followers.filter(
        (id) => id.toString() !== currentUserId
      );
    } else {
      // Follow
      const newFollow = new Follow({
        followerId: currentUserId,
        followeeId: userId,
      });
      await newFollow.save();
      if (!currentUser.following.includes(userId)) {
        currentUser.following.push(userId);
      }
      if (!targetUser.followers.includes(currentUserId)) {
        targetUser.followers.push(currentUserId);
      }

      // Create follow notification for target user
      const followNotification = new Notification({
        user_id: userId,
        type: "follow",
        message: `${currentUser.name} followed you`,
        related_id: currentUserId,
        read: false,
      });
      await followNotification.save();

      // Check for mutual follow and create chat + follow-back notification
      const isMutual = await Follow.findOne({
        followerId: userId,
        followeeId: currentUserId,
      });
      if (isMutual) {
        const existingChat = await Chat.findOne({
          $or: [
            { user1_id: currentUserId, user2_id: userId },
            { user1_id: userId, user2_id: currentUserId },
          ],
        });
        if (!existingChat) {
          const chat = new Chat({
            user1_id: currentUserId,
            user2_id: userId,
            deletedBy: [],
          });
          await chat.save();
          console.log(`Chat created between ${currentUserId} and ${userId}: ${chat._id}`);
          
          // Emit chat creation event via socket
          const io = req.app.get("io");
          const users = req.app.get("users");
          const userSocket = users.get(currentUserId);
          const targetSocket = users.get(userId);
          if (userSocket) {
            io.to(userSocket).emit("chat_created", { chatId: chat._id, user: targetUser });
          }
          if (targetSocket) {
            io.to(targetSocket).emit("chat_created", { chatId: chat._id, user: currentUser });
          }
        }

        // Create follow-back notification for current user
        const followBackNotification = new Notification({
          user_id: currentUserId,
          type: "follow",
          message: `${targetUser.name} followed you back`,
          related_id: userId,
          read: false,
        });
        await followBackNotification.save();
      }
    }

    await Promise.all([currentUser.save(), targetUser.save()]);

    res.status(200).json({
      message: isFollowing ? "Unfollowed successfully" : "Followed successfully",
      isFollowing: !isFollowing,
    });
  } catch (error) {
    console.error("Error in followUser:", error);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
};


export const isFollowing = async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user._id.toString();

  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const follow = await Follow.findOne({
      followerId: currentUserId,
      followeeId: userId,
    });

    res.status(200).json({ isFollowing: !!follow });
  } catch (error) {
    console.error("Error in isFollowing:", error);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
};


export const updateUserProfile = async (req, res) => {
  const { bio } = req.body;
  const profile_image = req.file; // Use req.file for upload.single
  const userId = req.user._id;

  try {
    console.log("Received update request:", {
      bio,
      hasFile: !!profile_image,
      profileImage: profile_image ? {
        name: profile_image.originalname,
        size: profile_image.size,
        mimetype: profile_image.mimetype,
      } : null,
    });

    const user = await User.findById(userId);
    if (!user) {
      console.log("User not found:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    // Update bio if provided
    if (bio !== undefined) {
      if (typeof bio !== "string" || bio.length > 160) {
        console.log("Invalid bio:", bio);
        return res.status(400).json({ message: "Bio must be a string and 160 characters or less" });
      }
      user.bio = bio;
      console.log("Updated bio:", bio);
    }

    // Handle image upload if provided
    if (profile_image) {
      console.log("Processing image:", {
        name: profile_image.originalname,
        size: profile_image.size,
        mimetype: profile_image.mimetype,
      });

      if (!profile_image.mimetype.startsWith("image/")) {
        console.log("Invalid file type:", profile_image.mimetype);
        return res.status(400).json({ message: "File must be an image" });
      }
      if (profile_image.size > 5 * 1024 * 1024) {
        console.log("File too large:", profile_image.size);
        return res.status(400).json({ message: "Image file size must be less than 5MB" });
      }

      // Delete existing image if present
      if (user.profile_image) {
        const publicId = user.profile_image.split("/").pop()?.split(".")[0];
        if (publicId) {
          try {
            await cloudinary.uploader.destroy(`profile_images/${publicId}`);
            console.log("Deleted old profile image:", publicId);
          } catch (err) {
            console.warn("Cloudinary delete failed (continuing):", err.message);
          }
        }
      }

      // Upload new image with retry logic
      let retries = 3;
      let profileImageUrl = null;
      while (retries > 0) {
        try {
          profileImageUrl = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              {
                folder: "profile_images",
                public_id: `${Date.now()}-${profile_image.originalname}`,
                resource_type: "image",
              },
              (error, result) => {
                if (error) {
                  console.error("Cloudinary upload error:", error.message);
                  return reject(new Error(`Cloudinary upload failed: ${error.message}`));
                }
                console.log("Uploaded new profile image:", result.secure_url);
                resolve(result.secure_url);
              }
            );

            const bufferStream = new PassThrough();
            bufferStream.end(profile_image.buffer);
            bufferStream.pipe(uploadStream);

            bufferStream.on("error", (error) => {
              console.error("Buffer stream error:", error.message);
              reject(error);
            });
          });
          break; // Exit loop on success
        } catch (error) {
          retries--;
          console.warn(`Upload retry ${4 - retries}/3 failed:`, error.message);
          if (retries === 0) {
            throw error;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s before retry
        }
      }

      user.profile_image = profileImageUrl;
      console.log("Set profile_image:", profileImageUrl);
    }

    // Save user to MongoDB
    await user.save();
    console.log("User saved to MongoDB:", {
      _id: user._id,
      profile_image: user.profile_image,
      bio: user.bio,
    });

    res.status(200).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone_number: user.phone_number,
        profile_image: user.profile_image,
        bio: user.bio,
        followers: user.followers,
        following: user.following,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
};