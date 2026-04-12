import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TradeNotification {
  id: string;
  pair: string;
  pnl: number;
  timestamp: number;
}

interface TradeNotificationsProps {
  notification: TradeNotification | null;
  autoCloseDuration?: number;
}

/**
 * Trade Notification Component
 * Toast that slides in when a new trade executes
 */
export const TradeNotifications: React.FC<TradeNotificationsProps> = ({
  notification,
  autoCloseDuration = 5000,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), autoCloseDuration);
      return () => clearTimeout(timer);
    }
  }, [notification, autoCloseDuration]);

  const isPositive = notification && notification.pnl >= 0;

  return (
    <AnimatePresence>
      {visible && notification && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: "spring", damping: 20 }}
          className={`fixed bottom-4 right-4 px-6 py-4 rounded-lg shadow-lg ${
            isPositive
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{isPositive ? "✅" : "⚠️"}</span>
            <div>
              <p className="font-bold">
                {isPositive ? "Trade Profit" : "Trade Loss"}
              </p>
              <p className="text-sm opacity-90">
                {notification.pair} · {isPositive ? "+" : ""}$
                {notification.pnl.toFixed(2)}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
