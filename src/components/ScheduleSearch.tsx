import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  Search, 
  Calendar, 
  Filter, 
  ChevronDown, 
  Share2, 
  Download, 
  Bell,
  Linkedin,
  Facebook,
  Twitter 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import ical from 'ical-generator';
import { ErrorBoundary } from './ErrorBoundary';

interface Schedule {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  level: number;
  suburbId: string;
}

interface Suburb {
  id: string;
  name: string;
  regionId: string;
}

interface ScheduleFilter {
  day: string;
  level: string;
  timeRange: string;
}

interface ShareOptions {
  type: 'whatsapp' | 'email' | 'copy';
}

type ExportFormat = 'csv' | 'pdf' | 'ical';

interface ExportState {
  loading: boolean;
  format: ExportFormat | null;
}

interface ValidationError {
  field: string;
  message: string;
}

type ICalWeekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

const dayToICalDay: Record<string, ICalWeekday> = {
  'Monday': 'MO',
  'Tuesday': 'TU',
  'Wednesday': 'WE',
  'Thursday': 'TH',
  'Friday': 'FR',
  'Saturday': 'SA',
  'Sunday': 'SU'
};

export default function ScheduleSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [suburbs, setSuburbs] = useState<Suburb[]>([]);
  const [filteredSuburbs, setFilteredSuburbs] = useState<Suburb[]>([]);
  const [selectedSuburb, setSelectedSuburb] = useState<Suburb | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ScheduleFilter>({
    day: '',
    level: '',
    timeRange: ''
  });
  const [showShareModal, setShowShareModal] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [exportState, setExportState] = useState<ExportState>({
    loading: false,
    format: null
  });
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const levels = ['1', '2', '3', '4'];
  const timeRanges = [
    { label: 'Morning (04:00 - 12:00)', value: 'morning' },
    { label: 'Afternoon (12:00 - 18:00)', value: 'afternoon' },
    { label: 'Evening (18:00 - 00:00)', value: 'evening' }
  ];

  // Fetch suburbs
  useEffect(() => {
    const fetchSuburbs = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "suburbs"));
        const suburbData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Suburb[];
        setSuburbs(suburbData);
      } catch (error) {
        console.error("Error fetching suburbs:", error);
        toast.error('Error loading suburbs');
      }
    };

    fetchSuburbs();
  }, []);

  // Filter suburbs based on search
  useEffect(() => {
    if (searchTerm) {
      const filtered = suburbs
        .filter(suburb => 
          suburb.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .slice(0, 5);
      setFilteredSuburbs(filtered);
    } else {
      setFilteredSuburbs([]);
    }
  }, [searchTerm, suburbs]);

  const fetchSchedules = async (suburb: Suburb) => {
    setLoading(true);
    try {
      if (!suburb?.id) {
        throw new Error('Invalid suburb selected');
      }

      const schedulesRef = collection(db, "schedules");
      const q = query(schedulesRef, where("suburbId", "==", suburb.id));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setSchedules([]);
        return;
      }

      const scheduleData: Schedule[] = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        data.sessions.forEach((session: any) => {
          scheduleData.push({
            id: doc.id,
            ...session,
            suburbId: suburb.id
          });
        });
      });

      // Apply filters
      let filteredSchedules = scheduleData;
      
      if (filters.day) {
        filteredSchedules = filteredSchedules.filter(s => s.day === filters.day);
      }
      
      if (filters.level) {
        filteredSchedules = filteredSchedules.filter(s => s.level === parseInt(filters.level));
      }
      
      if (filters.timeRange) {
        filteredSchedules = filteredSchedules.filter(s => {
          const time = parseInt(s.startTime.split(':')[0]);
          switch (filters.timeRange) {
            case 'morning':
              return time >= 4 && time < 12;
            case 'afternoon':
              return time >= 12 && time < 18;
            case 'evening':
              return time >= 18 || time < 4;
            default:
              return true;
          }
        });
      }

      // Sort by day and time
      filteredSchedules.sort((a, b) => {
        const dayDiff = days.indexOf(a.day) - days.indexOf(b.day);
        if (dayDiff === 0) {
          return a.startTime.localeCompare(b.startTime);
        }
        return dayDiff;
      });

      setSchedules(filteredSchedules);
    } catch (error) {
      console.error("Error fetching schedules:", error);
      toast.error(error instanceof Error ? error.message : 'Error loading schedules');
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof ScheduleFilter, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    if (selectedSuburb) {
      fetchSchedules(selectedSuburb);
    }
  };

  const exportToCSV = async () => {
    if (!schedules.length) return;

    const headers = ['Day', 'Start Time', 'End Time', 'Level'];
    const csvContent = [
      headers.join(','),
      ...schedules.map(schedule => 
        [
          schedule.day,
          schedule.startTime,
          schedule.endTime,
          schedule.level
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSuburb?.name}_schedules.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = async () => {
    if (!schedules.length) return;

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Load Shedding Schedule - ${selectedSuburb?.name}`, 20, 20);
    
    doc.setFontSize(12);
    let y = 40;
    schedules.forEach((schedule) => {
      doc.text(`${schedule.day}: ${schedule.startTime} - ${schedule.endTime} (Level ${schedule.level})`, 20, y);
      y += 10;
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save(`${selectedSuburb?.name}_schedules.pdf`);
  };

  const exportToICal = async () => {
    const cal = ical({ name: `Load Shedding - ${selectedSuburb?.name}` });

    schedules.forEach(schedule => {
      const [startHour, startMinute] = schedule.startTime.split(':');
      const [endHour, endMinute] = schedule.endTime.split(':');
      
      const start = new Date();
      start.setHours(parseInt(startHour), parseInt(startMinute), 0);
      
      const end = new Date();
      end.setHours(parseInt(endHour), parseInt(endMinute), 0);

      cal.createEvent({
        start,
        end,
        summary: `Load Shedding Level ${schedule.level}`,
        description: `Load shedding in ${selectedSuburb?.name}`,
        repeating: {
          freq: 'weekly',
          byday: [dayToICalDay[schedule.day]],
          count: 52
        }
      });
    });

    const blob = new Blob([cal.toString()], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSuburb?.name}_schedule.ics`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const shareSchedule = (options: ShareOptions) => {
    const scheduleText = schedules
      .map(s => `${s.day}: ${s.startTime}-${s.endTime} (Level ${s.level})`)
      .join('\n');
    const text = `Load Shedding Schedule for ${selectedSuburb?.name}:\n${scheduleText}`;

    switch (options.type) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
        break;
      case 'email':
        window.open(`mailto:?subject=Load Shedding Schedule&body=${encodeURIComponent(text)}`);
        break;
      case 'copy':
        navigator.clipboard.writeText(text);
        toast.success('Schedule copied to clipboard');
        break;
    }
    setShowShareModal(false);
  };

  const shareToSocial = (platform: 'facebook' | 'twitter' | 'linkedin') => {
    const text = `Check out the load shedding schedule for ${selectedSuburb?.name}`;
    const url = window.location.href;

    switch (platform) {
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
        break;
      case 'linkedin':
        window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`);
        break;
    }
  };

  const requestNotifications = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        scheduleNotifications();
        toast.success('Notifications enabled');
      } else {
        toast.error('Notification permission denied');
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Error enabling notifications');
    }
  };

  const scheduleNotifications = () => {
    if (!schedules.length) return;

    schedules.forEach(schedule => {
      const [hours, minutes] = schedule.startTime.split(':');
      const scheduleTime = new Date();
      scheduleTime.setHours(parseInt(hours), parseInt(minutes) - 30, 0); // 30 min before

      if (scheduleTime > new Date()) {
        const timeUntilNotification = scheduleTime.getTime() - new Date().getTime();
        setTimeout(() => {
          new Notification('Load Shedding Alert', {
            body: `Load shedding will start in 30 minutes in ${selectedSuburb?.name}`,
            icon: '/path-to-your-icon.png'
          });
        }, timeUntilNotification);
      }
    });
  };

  const handleExport = async (format: ExportFormat) => {
    if (!schedules.length) return;

    setExportState({ loading: true, format });
    try {
      switch (format) {
        case 'csv':
          await exportToCSV();
          break;
        case 'pdf':
          await exportToPDF();
          break;
        case 'ical':
          await exportToICal();
          break;
      }
      toast.success(`Exported to ${format.toUpperCase()}`);
    } catch (error) {
      console.error(`Error exporting to ${format}:`, error);
      toast.error(`Failed to export to ${format.toUpperCase()}`);
    }
    setExportState({ loading: false, format: null });
  };

  const validateInput = (value: string, field: string): ValidationError | null => {
    switch (field) {
      case 'search':
        if (value.length < 2) {
          return { field, message: 'Search term must be at least 2 characters' };
        }
        if (!/^[a-zA-Z\s]+$/.test(value)) {
          return { field, message: 'Only letters and spaces are allowed' };
        }
        break;
      // Add more validation cases as needed
    }
    return null;
  };

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    const error = validateInput(value, 'search');
    if (error) {
      setValidationErrors(prev => [...prev.filter(e => e.field !== 'search'), error]);
    } else {
      setValidationErrors(prev => prev.filter(e => e.field !== 'search'));
    }
  };

  return (
    <ErrorBoundary>
      <div className="max-w-4xl mx-auto">
        {/* Search Box */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search Your Suburb
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Enter suburb name..."
                value={searchTerm}
                onChange={handleSearchInput}
                className={`w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border ${
                  validationErrors.some(e => e.field === 'search')
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-200 dark:border-gray-600 focus:ring-blue-500'
                } rounded-xl focus:ring-2`}
              />
              
              {/* Search Results Dropdown */}
              {filteredSuburbs.length > 0 && (
                <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                  {filteredSuburbs.map((suburb) => (
                    <button
                      key={suburb.id}
                      onClick={() => {
                        setSelectedSuburb(suburb);
                        setSearchTerm(suburb.name);
                        setFilteredSuburbs([]);
                        fetchSchedules(suburb);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-2"
                    >
                      <Search className="h-4 w-4 text-blue-500" />
                      <span className="text-gray-700 dark:text-gray-200">{suburb.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {validationErrors.map(error => error.field === 'search' && (
              <p key={error.field} className="mt-1 text-sm text-red-500">
                {error.message}
              </p>
            ))}
          </div>
        </div>

        {/* Filters */}
        {selectedSuburb && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 mb-4"
            >
              <Filter className="h-5 w-5" />
              <span>Filters</span>
              <ChevronDown className={`h-5 w-5 transform transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Day
                  </label>
                  <select
                    value={filters.day}
                    onChange={(e) => handleFilterChange('day', e.target.value)}
                    className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                  >
                    <option value="">All Days</option>
                    {days.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Level
                  </label>
                  <select
                    value={filters.level}
                    onChange={(e) => handleFilterChange('level', e.target.value)}
                    className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                  >
                    <option value="">All Levels</option>
                    {levels.map(level => (
                      <option key={level} value={level}>Level {level}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Time Range
                  </label>
                  <select
                    value={filters.timeRange}
                    onChange={(e) => handleFilterChange('timeRange', e.target.value)}
                    className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                  >
                    <option value="">All Times</option>
                    {timeRanges.map(range => (
                      <option key={range.value} value={range.value}>{range.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading schedules...</p>
          </div>
        )}

        {/* Schedule List */}
        {!loading && selectedSuburb && schedules.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Day
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Level
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {schedules.map((schedule, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {schedule.day}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {schedule.startTime} - {schedule.endTime}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                          Level {schedule.level}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex justify-between items-center">
              <div className="flex space-x-4">
                <div className="dropdown relative">
                  <button 
                    className="flex items-center space-x-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg"
                    disabled={exportState.loading}
                  >
                    {exportState.loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-500 border-t-transparent" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span>{exportState.loading ? `Exporting ${exportState.format?.toUpperCase()}...` : 'Export'}</span>
                  </button>
                  <div className="dropdown-content absolute mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                    <button 
                      onClick={() => handleExport('csv')} 
                      disabled={exportState.loading}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                      CSV
                    </button>
                    <button 
                      onClick={() => handleExport('pdf')} 
                      disabled={exportState.loading}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                      PDF
                    </button>
                    <button 
                      onClick={() => handleExport('ical')} 
                      disabled={exportState.loading}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                      ICS
                    </button>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowShareModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/30"
                >
                  <Share2 className="h-4 w-4" />
                  <span>Share</span>
                </button>
              </div>

              <button
                onClick={requestNotifications}
                disabled={notificationsEnabled}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800/30 disabled:opacity-50"
              >
                <Bell className="h-4 w-4" />
                <span>{notificationsEnabled ? 'Notifications On' : 'Enable Notifications'}</span>
              </button>
            </div>
          </div>
        )}

        {/* No Results */}
        {!loading && selectedSuburb && schedules.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Schedules Found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              No schedules match your current filters. Try adjusting your search criteria.
            </p>
          </div>
        )}

        {/* Share Modal */}
        {showShareModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Share Schedule
              </h3>
              <div className="space-y-3">
                <button
                  onClick={() => shareSchedule({ type: 'whatsapp' })}
                  className="w-full flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100"
                >
                  <span>Share via WhatsApp</span>
                  <Share2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => shareSchedule({ type: 'email' })}
                  className="w-full flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100"
                >
                  <span>Share via Email</span>
                  <Share2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => shareSchedule({ type: 'copy' })}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100"
                >
                  <span>Copy to Clipboard</span>
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="mt-4 w-full p-3 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Add social media buttons */}
        <div className="flex justify-center space-x-4 mt-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => shareToSocial('facebook')}
            className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200"
          >
            <Facebook className="h-5 w-5" />
          </button>
          <button
            onClick={() => shareToSocial('twitter')}
            className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200"
          >
            <Twitter className="h-5 w-5" />
          </button>
          <button
            onClick={() => shareToSocial('linkedin')}
            className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200"
          >
            <Linkedin className="h-5 w-5" />
          </button>
        </div>
      </div>
    </ErrorBoundary>
  );
}