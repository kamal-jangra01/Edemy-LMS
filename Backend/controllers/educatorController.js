import { clerkClient } from "@clerk/express";
import { v2 as cloudinary } from "cloudinary";
import Course from "../models/Course.js";
import { Purchase } from "../models/Purchase.js";
import User from "../models/User.js";

//update role to educator
export const updateRoleToEducator = async (req, res) => {
  try {
    const { userId } = req.auth(); // ✅ FIX

    console.log("USER ID:", userId);

    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: {
        role: "educator",
      },
    });

    res.json({ success: true, message: "You can publish a course now" });
  } catch (error) {
    console.log("ERROR:", error.message);
    res.json({ success: false, message: error.message });
  }
};

//add new course
export const addCourse = async (req, res) => {
  try {
    const { courseData } = req.body;
    const imageFile = req.file;

    const { userId } = req.auth(); // ✅ FIX
    const educatorId = userId;

    if (!imageFile) {
      return res.json({ success: false, message: "Thumbnail Not Attached" });
    }

    const parsedCourseData = JSON.parse(courseData);
    parsedCourseData.educator = educatorId;

    const newCourse = await Course.create(parsedCourseData);

    const imageUpload = await cloudinary.uploader.upload(imageFile.path, {
      folder: `${process.env.CLOUDINARY_FOLDER}`,
    });

    newCourse.courseThumbnail = imageUpload.secure_url;

    await newCourse.save();

    res.json({ success: true, message: "course added" });
  } catch (error) {
    console.log("ERROR:", error.message);
    res.json({ success: false, message: error.message });
  }
};

//get educator courses
export const getEducatorCourses = async (req, res) => {
  try {
    const { userId } = req.auth();
    const courses = await Course.find({ educator: userId });
    res.json({ success: true, data: courses });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

//get educator dashboard data

export const educatorDashboardData = async (req, res) => {
  try {
    const { userId } = req.auth(); // ✅ FIX

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const courses = await Course.find({ educator: userId });
    const totalCourses = courses.length;

    const courseIds = courses.map((course) => course._id);

    const purchases = await Purchase.find({
      courseId: { $in: courseIds },
      status: "completed",
    });

    const totalEarnings = purchases.reduce(
      (sum, purchase) => sum + purchase.amount,
      0,
    );

    // collect enrolled students
    const enrolledStudentsData = [];

    for (const course of courses) {
      const students = await User.find(
        { _id: { $in: course.enrolledStudents } },
        "name imageUrl",
      );

      students.forEach((student) => {
        enrolledStudentsData.push({
          courseTitle: course.courseTitle,
          student,
        });
      });
    }

    res.json({
      success: true,
      dashboardData: {
        totalCourses,
        totalEarnings,
        enrolledStudentsData,
      },
    });
  } catch (error) {
    console.log("DASHBOARD ERROR:", error.message);
    res.json({ success: false, message: error.message });
  }
};

//get enrolled students data
export const getEnrolledStudentsData = async (req, res) => {
  try {
    const { userId } = req.auth(); // ✅ FIX

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const courses = await Course.find({ educator: userId });
    const courseIds = courses.map((course) => course._id);

    const purchases = await Purchase.find({
      courseId: { $in: courseIds },
      status: "completed",
    })
      .populate("userId", "name imageUrl")
      .populate("courseId", "courseTitle");

    const enrolledStudents = purchases.map((purchase) => ({
      student: purchase.userId,
      courseTitle: purchase.courseId?.courseTitle, // ✅ safe access
      purchaseDate: purchase.createdAt,
    }));

    res.json({ success: true, enrolledStudents });
  } catch (error) {
    console.log("ENROLLED STUDENTS ERROR:", error.message);
    res.json({ success: false, message: error.message });
  }
};
