import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Utensils, Clock, Building, RefreshCw, ChefHat } from 'lucide-react';
import { Button } from '../ui/Button.js';
import { StatusTag } from '../ui/StatusTag.js';
import { ErrorState } from '../ui/ErrorState.js';

interface MealSlot {
  meal_id: number;
  meal_date: string;
  menu: string;
  is_closed: number;
  meal_type_id: number;
  type_name: 'BREAKFAST' | 'LUNCH' | 'SNACKS' | 'DINNER';
  start_time: string;
  end_time: string;
  hostel_id: number;
  hostel_name: string;
}

interface MealTypeMeta {
  meal_type_id: number;
  type_name: string;
  start_time: string;
  end_time: string;
}

interface HostelMeta {
  hostel_id: number;
  hostel_name: string;
}

export const MessTimetable: React.FC = () => {
  const [selectedHostel, setSelectedHostel] = useState<number>(1);
  const [selectedMealType, setSelectedMealType] = useState<string>('ALL');

  const { data, isLoading, error, refetch, isFetching } = useQuery<{
    hostel_id: number;
    meal_types: MealTypeMeta[];
    hostels: HostelMeta[];
    meals: MealSlot[];
  }>({
    queryKey: ['mess-timetable', selectedHostel],
    queryFn: async () => {
      const res = await fetch(`/api/mess/timetable?hostel_id=${selectedHostel}`);
      if (!res.ok) {
        throw new Error(`Failed to load mess timetable (${res.status})`);
      }
      return res.json();
    },
  });

  const meals = data?.meals || [];
  const hostels = data?.hostels || [];
  const mealTypes = data?.meal_types || [];

  // Group meals by date
  const mealsByDate = meals.reduce<Record<string, MealSlot[]>>((acc, meal) => {
    const dateStr = meal.meal_date.split('T')[0];
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(meal);
    return acc;
  }, {});

  const dates = Object.keys(mealsByDate).sort();

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <ErrorState
          title="Mess Timetable Offline"
          message={(error as Error).message}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white border-2 border-black rounded-[4px] p-6 shadow-hard-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="p-1.5 bg-saffron border-2 border-black rounded-[4px] text-black">
              <Calendar className="w-5 h-5" strokeWidth={2.5} />
            </span>
            <h1 className="text-2xl font-heading font-extrabold tracking-tight text-black">
              Weekly Mess Timetable & Menu Schedule
            </h1>
          </div>
          <p className="text-xs text-black/75 font-medium">
            Institutional dining rotation across 4 daily meal slots with real-time menu provisions and operating hours.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh Menu</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border-2 border-black rounded-[4px] p-4 shadow-hard flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-black">
            <Building className="w-4 h-4 text-black/60" />
            <span>Dining Hall:</span>
          </div>
          <select
            value={selectedHostel}
            onChange={(e) => setSelectedHostel(Number(e.target.value))}
            className="px-3 py-1.5 bg-paper/30 border-2 border-black rounded-[4px] text-xs font-bold text-black focus:outline-none focus:bg-white"
          >
            {hostels.map((h) => (
              <option key={h.hostel_id} value={h.hostel_id}>
                {h.hostel_name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 text-xs font-bold text-black ml-2">
            <Utensils className="w-4 h-4 text-black/60" />
            <span>Slot:</span>
          </div>
          <select
            value={selectedMealType}
            onChange={(e) => setSelectedMealType(e.target.value)}
            className="px-3 py-1.5 bg-paper/30 border-2 border-black rounded-[4px] text-xs font-bold text-black focus:outline-none focus:bg-white"
          >
            <option value="ALL">All Slots (4 Daily)</option>
            {mealTypes.map((mt) => (
              <option key={mt.meal_type_id} value={mt.type_name}>
                {mt.type_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono font-bold text-black">
          <span className="px-2.5 py-1 bg-paper border-2 border-black rounded-[4px]">
            {dates.length} Days Scheduled
          </span>
        </div>
      </div>

      {/* Meal Types Reference Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {mealTypes.map((mt) => (
          <div
            key={mt.meal_type_id}
            className="bg-white border-2 border-black rounded-[4px] p-3 shadow-hard flex items-center justify-between"
          >
            <div>
              <span className="text-[10px] font-mono uppercase font-bold text-black/60">Slot {mt.meal_type_id}</span>
              <h4 className="font-heading font-extrabold text-sm text-black">{mt.type_name}</h4>
            </div>
            <div className="text-right">
              <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-black">
                <Clock className="w-3 h-3 text-black/60" />
                {mt.start_time.slice(0, 5)} - {mt.end_time.slice(0, 5)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Schedule Table / Cards */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white border-2 border-black rounded-[4px] shadow-hard animate-pulse" />
          ))}
        </div>
      ) : dates.length === 0 ? (
        <div className="bg-white border-2 border-black rounded-[4px] p-12 text-center shadow-hard">
          <ChefHat className="w-10 h-10 text-black/40 mx-auto mb-3" />
          <h3 className="font-heading font-extrabold text-base text-black mb-1">No meals scheduled for this hostel</h3>
          <p className="text-xs text-black/70 max-w-sm mx-auto mb-4 font-medium">
            Generate meal records for the current academic month to populate the dining calendar.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {dates.map((dateStr) => {
            const dayMeals = mealsByDate[dateStr].filter(
              (m) => selectedMealType === 'ALL' || m.type_name === selectedMealType
            );
            if (dayMeals.length === 0) return null;

            const dateObj = new Date(dateStr);
            const isToday =
              new Date().toISOString().split('T')[0] === dateStr;

            return (
              <div
                key={dateStr}
                className={`bg-white border-2 border-black rounded-[4px] shadow-hard overflow-hidden ${
                  isToday ? 'ring-2 ring-saffron ring-offset-2' : ''
                }`}
              >
                {/* Date header */}
                <div className={`px-4 py-3 border-b-2 border-black flex items-center justify-between ${isToday ? 'bg-saffron' : 'bg-paper'}`}>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-black" />
                    <h3 className="font-heading font-extrabold text-sm text-black">
                      {dateObj.toLocaleDateString('en-IN', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'Asia/Kolkata',
                      })}
                    </h3>
                    {isToday && (
                      <span className="px-2 py-0.5 bg-black text-white text-[10px] font-mono font-bold rounded-[3px] ml-2">
                        TODAY
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono font-bold text-black/70">
                    {dayMeals.length} slots
                  </span>
                </div>

                {/* Slots grid */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {dayMeals.map((meal) => (
                    <div
                      key={meal.meal_id}
                      className="p-3 bg-paper/20 border-2 border-black rounded-[4px] flex flex-col justify-between space-y-2 hover:bg-paper/40 transition-colors"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-heading font-extrabold text-xs text-black">
                            {meal.type_name}
                          </span>
                          <StatusTag
                            status={meal.is_closed ? 'neutral' : 'success'}
                            label={meal.is_closed ? 'CLOSED' : 'OPEN'}
                            size="sm"
                          />
                        </div>
                        <span className="text-[10px] font-mono text-black/60 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {meal.start_time.slice(0, 5)} - {meal.end_time.slice(0, 5)}
                        </span>
                        <p className="text-xs text-black font-medium mt-2 leading-relaxed line-clamp-3">
                          {meal.menu || 'Standard university catering provision.'}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-black/10 flex items-center justify-between text-[10px] font-mono text-black/70">
                        <span>Meal #{meal.meal_id}</span>
                        <span className="font-bold text-black">NSUT Kitchen</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
