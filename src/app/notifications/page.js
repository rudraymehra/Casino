'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Load notifications from localStorage
    try {
      const stored = localStorage.getItem('casino_notifications');
      if (stored) {
        setNotifications(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }, []);

  const clearAllNotifications = () => {
    setNotifications([]);
    try {
      localStorage.removeItem('casino_notifications');
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const removeNotification = (id) => {
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    try {
      localStorage.setItem('casino_notifications', JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving notifications:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#070005] to-[#150012] py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-white mb-2">Notifications</h1>
          <p className="text-white/60">Stay updated with your casino activity</p>
        </motion.div>

        {notifications.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 flex justify-end"
          >
            <button
              onClick={clearAllNotifications}
              className="text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Clear all notifications
            </button>
          </motion.div>
        )}

        <div className="space-y-4">
          {notifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-br from-[#290023]/80 to-[#150012]/90 rounded-xl border border-purple-700/30 p-12 text-center"
            >
              <div className="text-6xl mb-4">🔔</div>
              <h3 className="text-xl text-white/80 mb-2">No notifications</h3>
              <p className="text-white/50">You're all caught up! Check back later for updates.</p>
            </motion.div>
          ) : (
            notifications.map((notification, index) => (
              <motion.div
                key={notification.id || index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gradient-to-br from-[#290023]/80 to-[#150012]/90 rounded-xl border border-purple-700/30 p-4 flex items-start gap-4"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  notification.type === 'win' ? 'bg-green-500/20' :
                  notification.type === 'loss' ? 'bg-red-500/20' :
                  'bg-blue-500/20'
                }`}>
                  {notification.type === 'win' ? '🎉' :
                   notification.type === 'loss' ? '😢' :
                   notification.type === 'deposit' ? '💰' :
                   notification.type === 'withdraw' ? '💸' : '📢'}
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-medium">{notification.title || 'Notification'}</h4>
                  <p className="text-white/60 text-sm">{notification.message}</p>
                  <p className="text-white/40 text-xs mt-1">
                    {notification.timestamp ? new Date(notification.timestamp).toLocaleString() : 'Just now'}
                  </p>
                </div>
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="text-white/40 hover:text-white/80 transition-colors"
                >
                  ✕
                </button>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

