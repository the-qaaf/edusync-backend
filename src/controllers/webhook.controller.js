
import { normalizePhoneNumber } from '../utils/phone.util.js';
import { formatHtmlToWhatsApp } from '../utils/format.util.js';
import * as studentsService from '../services/students.service.js';
import * as dailyUpdatesService from '../services/daily-updates.service.js';
import * as broadcastService from '../services/broadcast.service.js';
import * as whatsappService from '../services/whatsapp.service.js';
import * as sessionService from '../services/session.service.js';

/**
 * Verify Webhook (GET)
 */
export const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
};

/**
 * Handle Incoming Messages (POST)
 */
export const handleIncomingMessage = async (req, res) => {

  try {
    const body = req.body;
    if (!body.object) {
      return res.sendStatus(404);
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      // No message found (status update or other event), just acknowledge
      return res.sendStatus(200);
    }

    // Mark as Read immediately to give user feedback
    await whatsappService.markMessageAsRead(message.id);

    const from = message.from;
    const type = message.type;
    const phone = normalizePhoneNumber(from);

    // 1. Identify Students
    const students = await studentsService.findStudentsByPhone(phone);

    if (students.length === 0) {
      await whatsappService.sendWhatsAppMessage(
        phone,
        "🚫 *Account Not Found*\n\nWe could not find any student linked to this number.\nPlease contact your school administrator to update your contact details."
      );
      return res.sendStatus(200);
    }

    // 2. Determine Action/Command
    let command = "";
    let payload = "";

    if (type === 'text') {
      const text = message.text.body.toLowerCase().trim();

      // Standard Greeting / Reset
      if (['hi', 'hello', 'start', 'menu', 'restart', 'hey'].includes(text)) {
        command = "START";
      }

      // Explicit Homework/Remark request
      else if (['homework', 'hw', 'remark', 'remarks', 'diary'].includes(text)) {
        command = "HOMEWORK";
      }

      // AI Tutor / Learning Query Detection
      else if (['tutor', 'ai', 'study', 'explain', 'question', 'doubt'].some(k => text.includes(k))) {
        command = "AI_TUTOR_QUERY";
      }
      else {
        command = "UNKNOWN";
      }
    } else if (type === 'interactive') {
      const replyId = message.interactive.button_reply?.id;
      if (replyId) {
        // Payload format convention: "CMD:DATA"
        if (replyId.startsWith("SELECT_STUDENT:")) {
          command = "SELECT_STUDENT";
          payload = replyId.split(":")[1];
        } else {
          command = replyId;
        }
      }
    }

    // 3. Multi-Student Resolution & Session
    let activeStudent = null;
    const sessionStudentId = sessionService.getSessionStudentId(phone);
    if (sessionStudentId) {
      activeStudent = students.find(s => s.studentId === sessionStudentId);
    }

    // --- State Machine & Logic ---

    // Handle Start/Greeting with Auto-Selection if possible
    if (command === "START") {
      if (students.length === 1) {
        activeStudent = students[0];
        sessionService.setSessionStudentId(phone, activeStudent.studentId);
        await sendMainMenu(phone, activeStudent);
      } else {
        await sendStudentSelectionMenu(phone, students);
      }
      return res.sendStatus(200);
    }

    if (command === "SELECT_STUDENT") {
      const selectedId = payload;
      activeStudent = students.find(s => s.studentId === selectedId);
      if (activeStudent) {
        sessionService.setSessionStudentId(phone, selectedId);
        await sendMainMenu(phone, activeStudent);
      } else {
        await whatsappService.sendWhatsAppMessage(phone, "🚫 Invalid selection. Please try again.");
      }
      return res.sendStatus(200);
    }

    // Ensure we have an active student for context-aware commands
    if (!activeStudent && students.length === 1) {
      activeStudent = students[0];
      sessionService.setSessionStudentId(phone, activeStudent.studentId);
    }

    if (!activeStudent && students.length > 1) {
      await sendStudentSelectionMenu(phone, students);
      return res.sendStatus(200);
    }

    // --- Feature Execution ---

    switch (command) {
      case "HOMEWORK":
        await handleHomeworkFlow(phone, activeStudent);
        break;

      case "UPDATES":
        await handleUpdatesFlow(phone, activeStudent);
        break;

      case "AI_TUTOR_QUERY":
        const frontendUrl = process.env.FRONTEND_URL || "https://edusync.vercel.app";
        const aiLink = `${frontendUrl}/ai-tutor/${activeStudent.schoolId}`;

        await whatsappService.sendWhatsAppMessage(
          phone,
          `🤖 *AI Tutor Assistant*\n🏫 *${activeStudent.schoolName}*\n\nHello! I noticed you have a question. Our AI Tutor is available 24/7 to help.\n\nIt understands the curriculum and can explain any topic instantly.`,
          [
            { type: "url", label: "Start Learning", url: aiLink }
          ]
        );
        break;

      case "HELP":
        await whatsappService.sendWhatsAppMessage(
          phone,
          `🤝 *Support & Assistance*\n\nNeed help? You can contact the school administration directly or reach out to our support team.\n\n📧 *Email:* support@edusync.com`
        );
        break;

      case "UNKNOWN":
        // Cool fallback
        await whatsappService.sendWhatsAppMessage(phone, "🤖 *I didn't catch that*\n\nI can help you with Homework, Updates, or connect you to the AI Tutor.\n\n*Please select an option below:*", [
          { id: "START", label: "🏠 Main Menu" },
          { id: "UPDATES", label: "🔔 Latest Updates" }
        ]);
        break;

      default:
        // Generic fallback
        await whatsappService.sendWhatsAppMessage(phone, "🤷‍♂️ *Command Not Recognized*\n\nPlease try one of the options below:", [
          { id: "START", label: "🏠 Home" }
        ]);
        break;
    }

    // Final Success Response
    res.sendStatus(200);

  } catch (error) {
    console.error("Webhook Controller Error:", error);
    // Even if error, send 200 to WhatsApp to stop retries (unless you want retries)
    res.sendStatus(200);
  }
};

// --- Sub-Flows & Helpers ---

const sendStudentSelectionMenu = async (phone, students) => {
  const buttons = students.slice(0, 3).map(s => ({
    id: `SELECT_STUDENT:${s.studentId}`,
    label: `👤 ${s.studentName.substring(0, 15)}`
  }));

  await whatsappService.sendWhatsAppMessage(
    phone,
    "👥 *Select Profile*\n\nWe found multiple profiles linked to this number. Who would you like to view details for?",
    buttons
  );
};

const sendMainMenu = async (phone, student) => {
  const greeting = `👋 *Welcome Back, ${student.parentName}*\n\n🏫 *${student.schoolName}*\n🎓 Student: *${student.studentName}*\n📚 Class: *${student.classGrade}-${student.section}*\n\nHow can we help you today?`;

  const buttons = [
    { id: "HOMEWORK", label: "📝 Homework" },
    { id: "UPDATES", label: "🔔 Updates" },
    { id: "HELP", label: "🤝 Help" }
  ];

  await whatsappService.sendWhatsAppMessage(phone, greeting, buttons);
};

const handleHomeworkFlow = async (phone, user) => {
  // Use today's date (YYYY-MM-DD)
  const today = new Date().toISOString().split('T')[0];
  const displayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const homeworks = await dailyUpdatesService.getHomework(
    user.schoolId,
    user.classGrade,
    user.section,
    today
  );

  // Filter out remarks not meant for this student
  const relevantItems = homeworks.filter(hw => {
    if (hw.type === 'remark') {
      return hw.studentId === user.studentId;
    }
    return true; // Include all homeworks
  });

  if (relevantItems.length === 0) {
    await whatsappService.sendWhatsAppMessage(
      phone,
      `📝 *Homework Updates*\n📅 ${displayDate}\n🏫 ${user.schoolName}\n\n✅ *All caught up!*\nNo homework or remarks for today.`,
      [{ id: "START", label: "🏠 Main Menu" }]
    );
    return;
  }

  let msg = `📝 *Homework & Remarks*\n📅 ${displayDate}\n🏫 *${user.schoolName}*\n`;

  relevantItems.forEach(hw => {
    if (hw.type === 'remark') {
      const note = hw.notes ? formatHtmlToWhatsApp(hw.notes) : "";
      msg += `\n────────────────\n`; // Separator
      msg += `💬 *Teacher Remark*`;
      msg += `\n${note}\n`;
      return;
    }

    const subject = hw.subject || "General";
    const desc = formatHtmlToWhatsApp(hw.homework);
    const notes = hw.notes ? formatHtmlToWhatsApp(hw.notes) : "";

    msg += `\n────────────────\n`; // Separator
    msg += `📌 *${subject}*`;
    msg += `\n${desc}\n`;

    if (notes) {
      msg += `\n💡 _Notes: ${notes}_\n`;
    }
  });

  msg += `\n────────────────\n_Reply 'Start' for Main Menu_`;

  await whatsappService.sendWhatsAppMessage(phone, msg);
};

const handleUpdatesFlow = async (phone, user) => {
  const today = new Date().toISOString().split('T')[0];
  const displayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const updates = await broadcastService.getAnnouncements(user.schoolId, today);

  if (!updates || updates.length === 0) {
    await whatsappService.sendWhatsAppMessage(
      phone,
      `🔔 *School Updates*\n📅 ${displayDate}\n🏫 ${user.schoolName}\n\n✅ *All clear!*\nNo new announcements for today.`,
      [{ id: "START", label: "🏠 Main Menu" }]
    );
    return;
  }

  let msg = `🔔 *School Announcements*\n📅 ${displayDate}\n🏫 *${user.schoolName}*\n`;

  updates.forEach(u => {
    const body = formatHtmlToWhatsApp(u.message);
    msg += `\n────────────────\n`;
    msg += `📢 *${u.title || 'Announcement'}*\n\n${body}`;
  });

  msg += `\n────────────────\n_Reply 'Start' for Main Menu_`;

  await whatsappService.sendWhatsAppMessage(phone, msg);
};
