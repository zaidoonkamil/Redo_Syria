require('dotenv').config();
const express = require("express");
const sequelize = require("./config/db");
const { PricingSetting, SystemSetting } = require("./models");
const { DEFAULT_PRICING } = require("./services/fareCalculator");

const usersRouter = require("./routes/user");
const notificationsRouter = require("./routes/notifications.js");
const ridesRouter = require("./routes/rides");
const adminRouter = require("./routes/admin");
const adminStatsRouter = require("./routes/adminStats");
const adminDebtRouter = require("./routes/adminDebt");
const whatsappRouter = require("./routes/whatsapp");
const { startWhatsAppAutoInit } = require("./services/waSender");

const redisService = require("./services/redis");
const socketService = require("./services/socket");
const chat = require("./routes/chatRoutes");
const cors = require("cors"); 

const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors({
  origin: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
}));
app.options(/.*/, cors());
app.use(express.json());
app.use("/uploads", express.static("./uploads"));

app.use("/", usersRouter);
app.use("/", notificationsRouter);
app.use("/", ridesRouter);
app.use("/", adminRouter);
app.use("/", adminStatsRouter);
app.use("/", adminDebtRouter);
app.use("/", whatsappRouter);
app.use("/", chat.router);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET","POST"],
    allowedHeaders: ["Content-Type","Authorization"],
  }
});

async function ensureSyriaPricingDefaults() {
  const key = "SYP_PRICING_DEFAULTS_APPLIED_V1";
  const applied = await SystemSetting.findOne({ where: { key } });
  if (applied) return;

  for (const serviceType of ["normal", "vip"]) {
    const defaults = DEFAULT_PRICING[serviceType] || DEFAULT_PRICING.normal;
    await PricingSetting.create({
      serviceType,
      baseFare: defaults.baseFare,
      pricePerKm: defaults.pricePerKm,
      pricePerMinute: defaults.pricePerMinute,
      minimumFare: defaults.minimumFare,
      roundingTo: defaults.roundingTo,
      surgeEnabled: false,
      surgeMultiplier: 1,
      updatedByAdminId: null,
    });
  }

  await SystemSetting.create({ key, value: "true" });
}

(async () => {
  try {
    await redisService.init();
    await socketService.init(io);
    const chatIO = io.of("/chat");
    chat.initChatSocket(chatIO); 
    try { await sequelize.query("ALTER TABLE `Users` ADD COLUMN `walletBalance` DECIMAL(14,2) NOT NULL DEFAULT 0.00;"); } catch (e) {}
    try { await sequelize.query("ALTER TABLE `RideRequests` ADD COLUMN `paymentMethod` ENUM('cash','online') NULL DEFAULT 'cash';"); } catch (e) {}

    await sequelize.sync({ force: false });
    try { await sequelize.query("ALTER TABLE `pricing_settings` ADD COLUMN `roundingTo` DECIMAL(10,2) NULL DEFAULT 5;"); } catch (e) {}
    await ensureSyriaPricingDefaults();
    startWhatsAppAutoInit();
    console.log("Database & tables synced!");

    server.listen(process.env.PORT || 1004, () => {
      console.log("Server running on http://localhost:" + (process.env.PORT || 1004));
    });
  } catch (err) {
    console.error("Startup error:", err);
    process.exit(1);
  }
})();

