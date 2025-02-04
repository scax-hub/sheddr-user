import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Search, MapPin, Clock, AlertCircle, Calendar, Bell } from 'lucide-react';
import toast from 'react-hot-toast';

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

interface UpcomingSchedule extends Schedule {
  timeUntilStart: string;
}

export default function LoadSheddingStatus() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suburbs, setSuburbs] = useState<Suburb[]>([]);
  const [filteredSuburbs, setFilteredSuburbs] = useState<Suburb[]>([]);
  const [selectedSuburb, setSelectedSuburb] = useState<Suburb | null>(null);
  const [currentSchedule, setCurrentSchedule] = useState<Schedule | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [upcomingSchedules, setUpcomingSchedules] = useState<UpcomingSchedule[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Fetch all suburbs on component mount
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
        toast.error('Error fetching suburbs');
      }
    };

    fetchSuburbs();
  }, []);

  // Filter suburbs based on search term
  useEffect(() => {
    if (searchTerm) {
      const filtered = suburbs.filter(suburb =>
        suburb.name.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 5);
      setFilteredSuburbs(filtered);
    } else {
      setFilteredSuburbs([]);
    }
  }, [searchTerm, suburbs]);

  // Check current schedule and update time remaining
  useEffect(() => {
    if (currentSchedule) {
      const interval = setInterval(() => {
        const now = new Date();
        const endTime = new Date();
        const [hours, minutes] = currentSchedule.endTime.split(':');
        endTime.setHours(parseInt(hours), parseInt(minutes), 0);

        if (now > endTime) {
          setCurrentSchedule(null);
          setTimeRemaining('');
          return;
        }

        const diff = endTime.getTime() - now.getTime();
        const minutesLeft = Math.floor(diff / 1000 / 60);
        const hoursLeft = Math.floor(minutesLeft / 60);
        const remainingMinutes = minutesLeft % 60;

        setTimeRemaining(
          `${hoursLeft > 0 ? `${hoursLeft}h ` : ''}${remainingMinutes}m remaining`
        );
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [currentSchedule]);

  const checkUpcomingSchedules = async (suburb: Suburb) => {
    try {
      const now = new Date();
      const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
      const currentTime = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      const schedulesRef = collection(db, "schedules");
      const q = query(
        schedulesRef,
        where("suburbId", "==", suburb.id)
      );

      const querySnapshot = await getDocs(q);
      const upcoming: UpcomingSchedule[] = [];

      querySnapshot.forEach(doc => {
        const scheduleData = doc.data();
        scheduleData.sessions.forEach((session: any) => {
          const startTime = new Date();
          const [hours, minutes] = session.startTime.split(':');
          startTime.setHours(parseInt(hours), parseInt(minutes), 0);

          // If schedule is in the future
          if (
            (session.day === currentDay && session.startTime > currentTime) ||
            getDayOffset(session.day) > getDayOffset(currentDay)
          ) {
            const timeUntil = getTimeUntilStart(session.day, session.startTime);
            upcoming.push({
              id: doc.id,
              ...session,
              suburbId: suburb.id,
              timeUntilStart: timeUntil
            });
          }
        });
      });

      // Sort by closest upcoming
      upcoming.sort((a, b) => {
        const dayDiff = getDayOffset(a.day) - getDayOffset(b.day);
        if (dayDiff === 0) {
          return a.startTime.localeCompare(b.startTime);
        }
        return dayDiff;
      });

      setUpcomingSchedules(upcoming.slice(0, 3)); // Show next 3 schedules
    } catch (error) {
      console.error("Error checking upcoming schedules:", error);
      toast.error('Error checking upcoming schedules');
    }
  };

  const getDayOffset = (day: string) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date().getDay();
    const targetDay = days.indexOf(day);
    return (targetDay + 7 - today) % 7;
  };

  const getTimeUntilStart = (day: string, startTime: string) => {
    const now = new Date();
    const start = new Date();
    const [hours, minutes] = startTime.split(':');
    start.setHours(parseInt(hours), parseInt(minutes), 0);
    
    const dayOffset = getDayOffset(day);
    start.setDate(start.getDate() + dayOffset);

    const diff = start.getTime() - now.getTime();
    const hoursUntil = Math.floor(diff / (1000 * 60 * 60));
    const minutesUntil = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hoursUntil >= 24) {
      const days = Math.floor(hoursUntil / 24);
      return `${days}d ${hoursUntil % 24}h`;
    }
    return `${hoursUntil}h ${minutesUntil}m`;
  };

  const requestNotificationPermission = async () => {
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
    if (!upcomingSchedules.length) return;

    upcomingSchedules.forEach(schedule => {
      const start = new Date();
      const [hours, minutes] = schedule.startTime.split(':');
      start.setHours(parseInt(hours), parseInt(minutes), 0);
      
      const dayOffset = getDayOffset(schedule.day);
      start.setDate(start.getDate() + dayOffset);

      // Notify 30 minutes before
      const notifyTime = new Date(start.getTime() - 30 * 60000);
      if (notifyTime > new Date()) {
        setTimeout(() => {
          new Notification('Load Shedding Alert', {
            body: `Load shedding will start in 30 minutes in ${selectedSuburb?.name}`,
            icon: '/path-to-your-icon.png'
          });
        }, notifyTime.getTime() - new Date().getTime());
      }
    });
  };

  const checkCurrentSchedule = async (suburb: Suburb) => {
    try {
      const now = new Date();
      const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
      const currentTime = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      const schedulesRef = collection(db, "schedules");
      const q = query(
        schedulesRef,
        where("suburbId", "==", suburb.id)
      );

      const querySnapshot = await getDocs(q);
      let activeSchedule: Schedule | null = null;

      querySnapshot.forEach(doc => {
        const scheduleData = doc.data();
        scheduleData.sessions.forEach((session: any) => {
          if (
            session.day === currentDay &&
            session.startTime <= currentTime &&
            session.endTime > currentTime
          ) {
            activeSchedule = {
              id: doc.id,
              ...session,
              suburbId: suburb.id
            };
          }
        });
      });

      setCurrentSchedule(activeSchedule);
      setSelectedSuburb(suburb);
      await checkUpcomingSchedules(suburb);
    } catch (error) {
      console.error("Error checking schedule:", error);
      toast.error('Error checking schedule');
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Load Shedding Status</h1>
        <p className="text-blue-100">Check current load shedding status for your area</p>
      </div>

      {/* Search Section */}
      <div className="max-w-xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search Your Suburb
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Enter suburb name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              {/* Suggestions Dropdown */}
              {showSuggestions && filteredSuburbs.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                  {filteredSuburbs.map((suburb) => (
                    <button
                      key={suburb.id}
                      onClick={() => {
                        checkCurrentSchedule(suburb);
                        setSearchTerm(suburb.name);
                        setShowSuggestions(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-2"
                    >
                      <MapPin className="h-4 w-4 text-blue-500" />
                      <span className="text-gray-700 dark:text-gray-200">{suburb.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Display */}
        {selectedSuburb && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                  {selectedSuburb.name}
                </h2>
              </div>
              <Clock className="h-5 w-5 text-gray-400" />
            </div>

            {currentSchedule ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/30 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span className="font-medium text-red-600 dark:text-red-400">
                      Load Shedding Active
                    </span>
                  </div>
                  <span className="text-sm font-medium text-red-500">
                    Level {currentSchedule.level}
                  </span>
                </div>

                <table className="min-w-full">
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    <tr>
                      <td className="py-2 text-sm text-gray-500 dark:text-gray-400">Start Time</td>
                      <td className="py-2 text-sm text-gray-900 dark:text-white font-medium">
                        {currentSchedule.startTime}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-sm text-gray-500 dark:text-gray-400">End Time</td>
                      <td className="py-2 text-sm text-gray-900 dark:text-white font-medium">
                        {currentSchedule.endTime}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-sm text-gray-500 dark:text-gray-400">Time Remaining</td>
                      <td className="py-2 text-sm text-red-600 dark:text-red-400 font-medium">
                        {timeRemaining}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    No Load Shedding Currently Active
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedSuburb && (
        <>
          {/* Map View Toggle */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setShowMap(!showMap)}
              className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              <MapPin className="h-4 w-4" />
              <span>{showMap ? 'Hide Map' : 'Show Map'}</span>
            </button>
          </div>

          {/* Map View */}
          {showMap && (
            <div className="mt-4 bg-gray-100 dark:bg-gray-700 rounded-xl h-64">
              {/* Add your map component here */}
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                Map View Coming Soon
              </div>
            </div>
          )}

          {/* Notifications */}
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bell className="h-5 w-5 text-blue-500" />
                <span className="text-blue-600 dark:text-blue-400">Notifications</span>
              </div>
              <button
                onClick={requestNotificationPermission}
                disabled={notificationsEnabled}
                className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-700 disabled:opacity-50"
              >
                {notificationsEnabled ? 'Enabled' : 'Enable Notifications'}
              </button>
            </div>
          </div>

          {/* Upcoming Schedules */}
          {upcomingSchedules.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                Upcoming Schedules
              </h3>
              <div className="space-y-3">
                {upcomingSchedules.map((schedule) => (
                  <div
                    key={`${schedule.id}-${schedule.day}-${schedule.startTime}`}
                    className="p-4 bg-orange-50 dark:bg-orange-900/30 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-orange-500" />
                        <span className="font-medium text-orange-600 dark:text-orange-400">
                          {schedule.day}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-orange-500">
                        Level {schedule.level}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">
                        {schedule.startTime} - {schedule.endTime}
                      </span>
                      <span className="text-orange-600 dark:text-orange-400">
                        Starts in {schedule.timeUntilStart}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
} 
