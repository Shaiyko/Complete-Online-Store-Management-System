import React, { useState, useEffect } from 'react';
import { Bell, X, AlertTriangle, ShoppingCart, Package } from 'lucide-react';

interface Notification {
  id: string;
  type: 'low-stock' | 'new-sale' | 'inventory-update';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

const RealTimeNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    // Listen for real-time events
    const handleLowStockAlert = (event: CustomEvent) => {
      const { productName, currentStock } = event.detail;
      addNotification({
        type: 'low-stock',
        title: 'Low Stock Alert',
        message: `${productName} is running low (${currentStock} left)`,
      });
    };

    const handleNewSale = (event: CustomEvent) => {
      const { total, items } = event.detail;
      addNotification({
        type: 'new-sale',
        title: 'New Sale',
        message: `Sale completed: ฿${total.toLocaleString()} (${items.length} items)`,
      });
    };

    const handleInventoryUpdate = (event: CustomEvent) => {
      const { productId, newStock } = event.detail;
      // Only show notification for significant stock changes
      if (newStock <= 5) {
        addNotification({
          type: 'inventory-update',
          title: 'Inventory Update',
          message: `Product stock updated: ${newStock} remaining`,
        });
      }
    };

    window.addEventListener('low-stock-alert', handleLowStockAlert as EventListener);
    window.addEventListener('new-sale', handleNewSale as EventListener);
    window.addEventListener('inventory-update', handleInventoryUpdate as EventListener);

    return () => {
      window.removeEventListener('low-stock-alert', handleLowStockAlert as EventListener);
      window.removeEventListener('new-sale', handleNewSale as EventListener);
      window.removeEventListener('inventory-update', handleInventoryUpdate as EventListener);
    };
  }, []);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false,
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 9)]); // Keep only 10 notifications
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'low-stock':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'new-sale':
        return <ShoppingCart className="h-5 w-5 text-green-500" />;
      case 'inventory-update':
        return <Package className="h-5 w-5 text-blue-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center space-x-2">
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex items-start space-x-3">
                      {getIcon(notification.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-600">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {notification.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RealTimeNotifications;