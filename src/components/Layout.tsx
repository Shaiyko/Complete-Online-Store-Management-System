import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RealTimeNotifications from './RealTimeNotifications';
import PWAInstallPrompt from './PWAInstallPrompt';
import ConnectionStatus from './ConnectionStatus';
import { 
  Home, 
  Package, 
  ShoppingCart, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut,
  Store,
  User,
  Truck
} from 'lucide-react';

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home, roles: ['owner', 'admin', 'cashier'] },
    { name: 'Products', href: '/products', icon: Package, roles: ['owner', 'admin'] },
    { name: 'Point of Sale', href: '/pos', icon: ShoppingCart, roles: ['owner', 'admin', 'cashier'] },
    { name: 'Members', href: '/members', icon: Users, roles: ['owner', 'admin', 'cashier'] },
    { name: 'Suppliers', href: '/suppliers', icon: Truck, roles: ['owner', 'admin'] },
    { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['owner', 'admin'] },
    { name: 'Settings', href: '/settings', icon: Settings, roles: ['owner'] },
  ];

  const filteredNavigation = navigation.filter(item => 
    item.roles.includes(user?.role || '')
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg">
        <div className="flex h-16 items-center justify-center border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Store className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">StoreManager</span>
          </div>
        </div>
        
        <nav className="mt-6 px-4">
          <div className="space-y-2">
            {filteredNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User info and logout */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {user?.role}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center h-8 w-8 text-gray-400 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        {/* Top bar with notifications */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex justify-end">
            <ConnectionStatus />
            <RealTimeNotifications />
          </div>
        </div>
        
        <main className="p-6">
          <Outlet />
        </main>
      </div>
      
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
};

export default Layout;