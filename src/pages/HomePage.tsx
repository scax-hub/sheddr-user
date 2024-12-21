import { useState } from 'react';
import { Search, AlertCircle, Calendar } from 'lucide-react';
import StatusCheck from '../components/StatusCheck';
import ScheduleSearch from '../components/ScheduleSearch';
import WeeklyView from '../components/WeeklyView';
import Layout from '../components/Layout';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'status' | 'search' | 'weekly'>('status');

  return (
    <Layout>
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            Load Shedding Schedule Checker
          </h1>
          <p className="text-blue-100 text-base sm:text-lg max-w-2xl mx-auto">
            Stay informed about load shedding schedules in your area. Check current status, search schedules, and view weekly forecasts.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="-mt-8 sm:-mt-10">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-2 sm:p-4">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            <button
              onClick={() => setActiveTab('status')}
              className={`flex items-center justify-center px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'status'
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>Current Status</span>
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center justify-center px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'search'
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Search className="h-5 w-5 mr-2" />
              <span>Search Schedule</span>
            </button>
            <button
              onClick={() => setActiveTab('weekly')}
              className={`flex items-center justify-center px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'weekly'
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Calendar className="h-5 w-5 mr-2" />
              <span>Weekly View</span>
            </button>
          </div>
        </div>

        {/* Content Sections */}
        <div className="mt-6">
          {activeTab === 'status' && <StatusCheck />}
          {activeTab === 'search' && <ScheduleSearch />}
          {activeTab === 'weekly' && <WeeklyView />}
        </div>
      </div>
    </Layout>
  );
} 