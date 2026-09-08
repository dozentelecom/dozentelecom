"use client";

import { useEffect, useState } from "react";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link?: string;
  createdAt?: string;
};

export default function NotificationBell() {
  const [notifications, setNotifications] =
    useState<NotificationItem[]>([]);

  const [unreadCount, setUnreadCount] =
    useState(0);

  const [open, setOpen] = useState(false);

  const [loading, setLoading] =
    useState(false);

  const loadNotifications = async () => {
    try {
      const response = await fetch(
        "/api/notifications",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (response.status === 401) {
        return;
      }

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      setNotifications(
        Array.isArray(data.notifications)
          ? data.notifications
          : []
      );

      setUnreadCount(
        Number(data.unreadCount || 0)
      );
    } catch (error) {
      console.error(
        "Failed to load notifications:",
        error
      );
    }
  };

  useEffect(() => {
    loadNotifications();

    const interval = window.setInterval(
      loadNotifications,
      30000
    );

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const markAsRead = async (
    notification: NotificationItem
  ) => {
    if (notification.read) {
      return;
    }

    try {
      await fetch(
        `/api/notifications/${notification.id}`,
        {
          method: "PATCH",
        }
      );

      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? {
                ...item,
                read: true,
              }
            : item
        )
      );

      setUnreadCount((count) =>
        Math.max(0, count - 1)
      );
    } catch (error) {
      console.error(
        "Failed to mark notification as read:",
        error
      );
    }
  };

  const handleNotificationClick = async (
    notification: NotificationItem
  ) => {
    await markAsRead(notification);

    if (notification.link) {
      window.location.href =
        notification.link;
    }
  };

  return (
    <>
      <button
        type="button"
        className="dt-notification-bell"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notifications"
        title="Notifications"
      >
        <span className="dt-bell-icon">
          🔔
        </span>

        {unreadCount > 0 && (
          <span className="dt-notification-badge">
            {unreadCount > 99
              ? "99+"
              : unreadCount}
          </span>
        )}
      </button>


      {open && (
        <div className="dt-notification-panel">

          <div className="dt-notification-header">

            <div>
              <strong>
                Notifications
              </strong>

              {unreadCount > 0 && (
                <span>
                  {unreadCount} unread
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close notifications"
            >
              ×
            </button>

          </div>


          <div className="dt-notification-list">

            {loading ? (
              <div className="dt-notification-empty">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="dt-notification-empty">

                <div className="dt-notification-empty-icon">
                  🔔
                </div>

                <strong>
                  No notifications
                </strong>

                <p>
                  You don't have any
                  notifications yet.
                </p>

              </div>
            ) : (
              notifications.map(
                (notification) => (
                  <button
                    type="button"
                    key={notification.id}
                    className={`dt-notification-item ${
                      notification.read
                        ? ""
                        : "unread"
                    }`}
                    onClick={() =>
                      handleNotificationClick(
                        notification
                      )
                    }
                  >

                    <div className="dt-notification-item-icon">
                      {notification.type ===
                      "SECURITY"
                        ? "🔐"
                        : notification.type ===
                            "TRANSACTION"
                          ? "💳"
                          : notification.type ===
                              "FUNDING"
                            ? "💰"
                            : notification.type ===
                                "PROMOTION"
                              ? "🎁"
                              : "📢"}
                    </div>

                    <div className="dt-notification-item-content">

                      <strong>
                        {notification.title}
                      </strong>

                      <p>
                        {notification.message}
                      </p>

                      {notification.createdAt && (
                        <small>
                          {new Date(
                            notification.createdAt
                          ).toLocaleString()}
                        </small>
                      )}

                    </div>

                    {!notification.read && (
                      <span className="dt-notification-unread-dot" />
                    )}

                  </button>
                )
              )
            )}

          </div>

        </div>
      )}
    </>
  );
}