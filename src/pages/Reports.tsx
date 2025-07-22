import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { Sale, Product } from '../types';
import StockLedger from '../components/StockLedger';
import AdvancedReporting from '../components/AdvancedReporting';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Calendar, 
  Download, 
  TrendingUp, 
  Package, 
  DollarSign,
  AlertTriangle,
  FileText,
  BarChart3
} from 'lucide-react';

const Reports: React.FC = () => {
  const [salesData, setSalesData] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [salesReport, setSalesReport] = useState<any>({
    summary: {
      totalRevenue: 0,
      totalSales: 0,
      averageOrderValue: 0
    },
    dailySales: [],
    topProducts: [],
    paymentMethods: []
  });
  const [inventoryReport, setInventoryReport] = useState<any>({
    totalProducts: 0,
    totalValue: 0,
    lowStockProducts: [],
    outOfStockProducts: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const [salesResponse, productsResponse] = await Promise.all([
        apiService.getSales(),
        apiService.getProducts()
      ]);
      
      // Handle products response
      const productList = Array.isArray(productsResponse) 
        ? productsResponse 
        : productsResponse.products || [];
      setProducts(productList);
      
      // Filter sales by date range
      const filteredSales = salesResponse.filter((sale: Sale) => {
        const saleDate = new Date(sale.createdAt);
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);
        return saleDate >= startDate && saleDate <= endDate;
      });
      
      setSalesData(filteredSales);
      
      // Calculate real sales report
      const totalRevenue = filteredSales.reduce((sum: number, sale: Sale) => sum + sale.total, 0);
      const totalSales = filteredSales.length;
      const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;
      
      // Calculate daily sales
      const dailySalesMap = new Map();
      filteredSales.forEach((sale: Sale) => {
        const date = new Date(sale.createdAt).toISOString().split('T')[0];
        if (!dailySalesMap.has(date)) {
          dailySalesMap.set(date, { date, sales: 0, orders: 0 });
        }
        const dayData = dailySalesMap.get(date);
        dayData.sales += sale.total;
        dayData.orders += 1;
      });
      
      const dailySales = Array.from(dailySalesMap.values()).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      // Calculate top products
      const productSalesMap = new Map();
      filteredSales.forEach((sale: Sale) => {
        sale.items.forEach(item => {
          if (!productSalesMap.has(item.productId)) {
            productSalesMap.set(item.productId, {
              productId: item.productId,
              name: item.name,
              quantity: 0,
              revenue: 0
            });
          }
          const productData = productSalesMap.get(item.productId);
          productData.quantity += item.quantity;
          productData.revenue += item.price * item.quantity;
        });
      });
      
      const topProducts = Array.from(productSalesMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
      
      // Calculate payment methods
      const paymentMethodsMap = new Map();
      filteredSales.forEach((sale: Sale) => {
        const method = sale.paymentMethod;
        if (!paymentMethodsMap.has(method)) {
          paymentMethodsMap.set(method, { name: method, value: 0, count: 0 });
        }
        const methodData = paymentMethodsMap.get(method);
        methodData.value += sale.total;
        methodData.count += 1;
      });
      
      const paymentMethods = Array.from(paymentMethodsMap.values());
      
      setSalesReport({
        summary: {
          totalRevenue,
          totalSales,
          averageOrderValue
        },
        dailySales,
        topProducts,
        paymentMethods
      });
      
      // Calculate inventory report
      const lowStockProducts = productList.filter((p: Product) => p.stock > 0 && p.stock <= 5);
      const outOfStockProducts = productList.filter((p: Product) => p.stock === 0);
      const totalValue = productList.reduce((sum: number, p: Product) => sum + (p.price * p.stock), 0);
      
      setInventoryReport({
        totalProducts: productList.length,
        totalValue,
        lowStockProducts,
        outOfStockProducts
      });
      
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = () => {
    setLoading(true);
    fetchReports();
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: BarChart3 },
    { id: 'advanced', name: 'Advanced Reports', icon: TrendingUp },
    { id: 'stock-ledger', name: 'Stock Ledger', icon: Package },
    { id: 'analytics', name: 'Analytics', icon: BarChart }
  ];

  // Calculate category data from real sales
  const getCategoryData = () => {
    const categoryMap = new Map();
    let totalRevenue = 0;
    
    salesData.forEach(sale => {
      sale.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const category = product?.category || 'อื่นๆ';
        const revenue = item.price * item.quantity;
        
        if (!categoryMap.has(category)) {
          categoryMap.set(category, 0);
        }
        categoryMap.set(category, categoryMap.get(category) + revenue);
        totalRevenue += revenue;
      });
    });
    
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
    return Array.from(categoryMap.entries())
      .map(([name, revenue], index) => ({
        name,
        value: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0,
        color: colors[index % colors.length]
      }))
      .sort((a, b) => b.value - a.value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">รายงาน</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2">
          <Download className="h-5 w-5" />
          <span>ส่งออกรายงาน</span>
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">ช่วงวันที่:</span>
          </div>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-500">ถึง</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleDateRangeChange}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            ใช้งาน
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">รายได้รวม ({dateRange.startDate} - {dateRange.endDate})</p>
              <p className="text-2xl font-bold text-gray-900">
                ฿{salesReport.summary.totalRevenue.toLocaleString()}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-sm text-gray-500 mt-2">จาก {salesReport.summary.totalSales} รายการ</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">ยอดขายรวม</p>
              <p className="text-2xl font-bold text-gray-900">
                {salesReport.summary.totalSales}
              </p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
          <p className="text-sm text-gray-500 mt-2">รายการขาย</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">ยอดขายเฉลี่ย</p>
              <p className="text-2xl font-bold text-gray-900">
                ฿{Math.round(salesReport.summary.averageOrderValue).toLocaleString()}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-600" />
          </div>
          <p className="text-sm text-gray-500 mt-2">ต่อรายการ</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">สินค้าใกล้หมด</p>
              <p className="text-2xl font-bold text-gray-900">
                {inventoryReport.lowStockProducts.length}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <p className="text-sm text-red-600 mt-2">สต็อก ≤ 5 ชิ้น</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">ยอดขายรายวัน</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salesReport.dailySales}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="sales" fill="#3B82F6" name="ยอดขาย (฿)" />
              <Bar dataKey="orders" fill="#10B981" name="จำนวนรายการ" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">ยอดขายตามหมวดหมู่</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={getCategoryData()}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {getCategoryData().map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Inventory Report */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">สถานะสินค้าคงคลัง</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {inventoryReport.totalProducts}
            </div>
            <div className="text-sm text-gray-600">สินค้าทั้งหมด</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              ฿{inventoryReport.totalValue.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">มูลค่าสินค้าคงคลัง</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {inventoryReport.outOfStockProducts.length}
            </div>
            <div className="text-sm text-gray-600">สินค้าหมด</div>
          </div>
        </div>

        {/* Low Stock Products */}
        {inventoryReport.lowStockProducts.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-3">สินค้าใกล้หมด</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      สินค้า
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      สต็อก
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      หมวดหมู่
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      ซัพพลายเออร์
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inventoryReport.lowStockProducts.map((product: Product) => (
                    <tr key={product.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-10 w-10 rounded-lg object-cover mr-3"
                          />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {product.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              ฿{product.price.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                          เหลือ {product.stock}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.supplier}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Top Selling Products */}
        {salesReport.topProducts.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium text-gray-900 mb-3">สินค้าขายดี (ช่วงเวลาที่เลือก)</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      สินค้า
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      จำนวนขาย
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      รายได้
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {salesReport.topProducts.slice(0, 5).map((item: any, index: number) => (
                    <tr key={item.productId}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-sm font-medium text-blue-600">
                              {index + 1}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-gray-900">
                            {item.name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-green-600">
                          {item.quantity} ชิ้น
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ฿{item.revenue.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
        </>
      )}

      {activeTab === 'advanced' && (
        <AdvancedReporting />
      )}

      {activeTab === 'stock-ledger' && (
        <StockLedger showProductFilter={true} />
      )}

      {activeTab === 'analytics' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">การวิเคราะห์ขั้นสูง</h3>
          <p className="text-gray-600">ฟีเจอร์การวิเคราะห์ขั้นสูงกำลังจะมาเร็วๆ นี้...</p>
        </div>
      )}
    </div>
  );
};

export default Reports;