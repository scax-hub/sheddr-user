import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Calendar, Clock, MapPin, Search, AlertCircle } from 'lucide-react';
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

interface DaySchedule {
  day: string;
  schedules: Schedule[];
}

export default function WeeklyView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [suburbs, setSuburbs] = useState<Suburb[]>([]);
  const [filteredSuburbs, setFilteredSuburbs] = useState<Suburb[]>([]);
  const [selectedSuburb, setSelectedSuburb] = useState<Suburb | null>(null);
  const [weeklySchedules, setWeeklySchedules] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(false);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const timeSlots = Array.from({ length: 24 }, (_, i) => 
    `${i.toString().padStart(2, '0')}:00`
  );

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

  const fetchWeeklySchedules = async (suburb: Suburb) => {
    setLoading(true);
    try {
      const schedulesRef = collection(db, "schedules");
      const q = query(schedulesRef, where("suburbId", "==", suburb.id));
      const querySnapshot = await getDocs(q);
      
      const schedulesByDay: { [key: string]: Schedule[] } = {};
      days.forEach(day => {
        schedulesByDay[day] = [];
      });

      querySnapshot.forEach(doc => {
        const data = doc.data();
        data.sessions.forEach((session: any) => {
          const schedule: Schedule = {
            id: doc.id,
            ...session,
            suburbId: suburb.id
          };
          schedulesByDay[schedule.day].push(schedule);
        });
      });

      // Sort schedules by time for each day
      Object.keys(schedulesByDay).forEach(day => {
        schedulesByDay[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
      });

      const weeklyData = days.map(day => ({
        day,
        schedules: schedulesByDay[day]
      }));

      setWeeklySchedules(weeklyData);
    } catch (error) {
      console.error("Error fetching schedules:", error);
      toast.error('Error loading schedules');
    }
    setLoading(false);
  };

  const getSchedulePosition = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return (hours + minutes / 60) * 60; // Convert to minutes from start of day
  };

  const getScheduleHeight = (startTime: string, endTime: string) => {
    const startMinutes = getSchedulePosition(startTime);
    const endMinutes = getSchedulePosition(endTime);
    return endMinutes - startMinutes;
  };

  return (
    <div className="max-w-7xl mx-auto">
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
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Search Results */}
          {filteredSuburbs.length > 0 && (
            <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
              {filteredSuburbs.map((suburb) => (
                <button
                  key={suburb.id}
                  onClick={() => {
                    setSelectedSuburb(suburb);
                    setSearchTerm(suburb.name);
                    setFilteredSuburbs([]);
                    fetchWeeklySchedules(suburb);
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

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading schedules...</p>
        </div>
      )}

      {/* Weekly Calendar View */}
      {!loading && selectedSuburb && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 overflow-x-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center">
              <Calendar className="h-6 w-6 mr-2 text-blue-500" />
              Weekly Schedule for {selectedSuburb.name}
            </h2>
          </div>

          <div className="grid grid-cols-8 gap-4 min-w-[1000px]">
            {/* Time Column */}
            <div className="space-y-2">
              <div className="h-12"></div> {/* Header spacer */}
              {timeSlots.map(time => (
                <div key={time} className="h-12 text-sm text-gray-500 dark:text-gray-400">
                  {time}
                </div>
              ))}
            </div>

            {/* Days Columns */}
            {weeklySchedules.map(({ day, schedules }) => (
              <div key={day} className="space-y-2">
                <div className="h-12 font-medium text-gray-800 dark:text-white text-center">
                  {day}
                </div>
                <div className="relative h-[1152px]"> {/* 24 * 48px for each hour */}
                  {/* Hour Grid Lines */}
                  {timeSlots.map((_, index) => (
                    <div
                      key={index}
                      className="absolute w-full h-12 border-t border-gray-100 dark:border-gray-700"
                      style={{ top: `${index * 48}px` }}
                    ></div>
                  ))}

                  {/* Schedule Blocks */}
                  {schedules.map((schedule, index) => {
                    const top = getSchedulePosition(schedule.startTime) * 2;
                    const height = getScheduleHeight(schedule.startTime, schedule.endTime) * 2;
                    
                    return (
                      <div
                        key={index}
                        className="absolute w-full px-1"
                        style={{ top: `${top}px` }}
                      >
                        <div
                          className={`p-2 rounded-lg text-xs font-medium ${
                            schedule.level <= 2
                              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                          }`}
                          style={{ height: `${height}px` }}
                        >
                          <div className="flex items-center justify-between">
                            <span>Level {schedule.level}</span>
                            <Clock className="h-3 w-3" />
                          </div>
                          <div className="mt-1 text-xs opacity-75">
                            {schedule.startTime} - {schedule.endTime}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Schedules */}
      {!loading && selectedSuburb && weeklySchedules.every(day => day.schedules.length === 0) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Schedules Found</h3>
          <p className="text-gray-500 dark:text-gray-400">
            No schedules are currently available for this suburb.
          </p>
        </div>
      )}
    </div>
  );
}