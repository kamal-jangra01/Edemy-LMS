import { Webhook } from "svix";
import User from "../models/User.js";
import Stripe from "stripe";
import Course from "../models/Course.js";
import { Purchase } from "../models/Purchase.js";

//API controller Function

export const clerkWebhooks = async (req, res) => {
  try {
    const whook = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
    await whook.verify(JSON.stringify(req.body), {
      "svix-id": req.headers["svix-id"],
      "svix-timestamp": req.headers["svix-timestamp"],
      "svix-signature": req.headers["svix-signature"],
    });
    const { data, type } = req.body;
    switch (type) {
      case "user.created": {
        const userData = {
          _id: data.id,
          email: data.email_addresses[0].email_address,
          name: data.first_name + " " + data.last_name,
          imageUrl: data.image_url,
        };
        await User.create(userData);
        res.json({});
        break;
      }
      case "user.updated": {
        const userData = {
          email: data.email_addresses[0].email_address,
          name: data.first_name + " " + data.last_name,
          imageUrl: data.image_url,
        };
        await User.findByIdAndUpdate(data.id, userData);
        res.json({});
        break;
      }
      case "user.deleted": {
        await User.findByIdAndDelete(data.id);
        res.json({});
        break;
      }
      default:
        break;
    }
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export default clerkWebhooks;

//stripewebhooks
const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);

export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripeInstance.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    console.log("Webhook Error:", error.message);
    return res.status(400).send(`Webhook error ${error.message}`);
  }

  // ✅ correct event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const purchaseId = session.metadata.purchaseId;

    const purchaseData = await Purchase.findById(purchaseId);

    if (!purchaseData) return res.sendStatus(404);

    const userData = await User.findById(purchaseData.userId);
    const courseData = await Course.findById(purchaseData.courseId);

    // ✅ enroll user
    await User.findByIdAndUpdate(purchaseData.userId, {
      $addToSet: { enrolledCourses: purchaseData.courseId },
    });

    await Course.findByIdAndUpdate(purchaseData.courseId, {
      $addToSet: { enrolledStudents: purchaseData.userId },
    });

    // ✅ update status
    purchaseData.status = "completed";
    await purchaseData.save();
  }
  res.json({ received: true });
};
