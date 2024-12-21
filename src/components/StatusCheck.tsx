import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Search, MapPin, Clock, AlertCircle } from 'lucide-react';
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

export default function StatusCheck() {
  const [searchTerm, setSearchTerm] = useState('');
  const [suburbs, setSuburbs] = useState<Suburb[]>([]);
  const [filteredSuburbs, setFilteredSuburbs] = useState<Suburb[]>([]);
  const [selectedSuburb, setSelectedSuburb] = useState<Suburb | null>(null);
  const [currentSchedule, setCurrentSchedule] = useState<Schedule | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Fetch suburbs for search
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

  // Update time remaining
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

  const checkSchedule = async (suburb: Suburb) => {
    setLoading(true);
    try {
      const now = new Date();
      const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
      const currentTime = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      const schedulesRef = collection(db, "schedules");
      const q = query(schedulesRef, where("suburbId", "==", suburb.id));
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
    } catch (error) {
      console.error("Error checking schedule:", error);
      toast.error('Error checking schedule');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
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
                    checkSchedule(suburb);
                    setSearchTerm(suburb.name);
                    setFilteredSuburbs([]);
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
          <p className="mt-4 text-gray-600 dark:text-gray-400">Checking schedule...</p>
        </div>
      )}

      {/* Status Display */}
      {!loading && selectedSuburb && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
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

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Start Time</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {currentSchedule.startTime}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">End Time</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {currentSchedule.endTime}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Time Remaining</p>
                <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                  {timeRemaining}
                </p>
              </div>
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
  );
}