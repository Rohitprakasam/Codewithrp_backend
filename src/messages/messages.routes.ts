import { Router } from "express";
import { getThreads, getChat, sendMessage, getAdminPeerId } from "./messages.controller";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

router.get("/messages/admin-peer", authMiddleware, getAdminPeerId);
router.get("/messages/threads", authMiddleware, getThreads);
router.get("/messages/:peerId", authMiddleware, getChat);
router.post("/messages", authMiddleware, sendMessage);

export default router;
