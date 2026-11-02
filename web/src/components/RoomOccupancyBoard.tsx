import React, { useState, useEffect } from 'react';
import {
  Building2,
  BedDouble,
  Sun,
  Moon,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { HostelBoard, RoomBoardItem } from '../types';

export const RoomOccupancyBoard: React.FC = () => {
  const [board, setBoard] = useState<HostelBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHostelId, setSelectedHostelId] = useState<number | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<RoomBoardItem | null>(null);

  const fetchBoard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/rooms/board');
      if (!res.ok) {
        throw new Error(`Failed to load occupancy board (${res.status}: ${res.statusText})`);
      }
      const json = await res.json();
      const data: HostelBoard[] = Array.isArray(json) ? json : (json.hostels || []);
      setBoard(data);
      if (data.length > 0 && selectedHostelId === null) {
        setSelectedHostelId(data[0].hostel_id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoard();
  }, []);

  const activeHostel = Array.isArray(board)
    ? board.find((h) => h.hostel_id === selectedHostelId) || board[0]
    : null;

  const totalBeds = Array.isArray(board)
    ? board.reduce(
        (acc, h) =>
          acc +
          (h.floors || []).reduce(
            (fAcc, f) => fAcc + (f.rooms || []).reduce((rAcc, r) => rAcc + r.capacity, 0),
            0
          ),
        0
      )
    : 0;

  const occupiedBeds = Array.isArray(board)
    ? board.reduce(
        (acc, h) =>
          acc +
          (h.floors || []).reduce(
            (fAcc, f) => fAcc + (f.rooms || []).reduce((rAcc, r) => rAcc + r.occupied_count, 0),
            0
          ),
        0
      )
    : 0;

  return (
    <div className="space-y-4">
      {/* Board Header & Metrics */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#EEF2FF] flex items-center justify-center text-[#2F5BD6]">
              <Building2 className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-sm text-[#0F172A]">Hostel Room Occupancy Board</h3>
              <p className="text-xs text-[#64748B]">Real-time visual floor & bed allocation matrix</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1.5 rounded">
              <span className="text-[#64748B]">Total Capacity:</span>
              <span className="font-bold text-[#0F172A] tabular-nums">
                {occupiedBeds} / {totalBeds} Beds ({totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0}%)
              </span>
            </div>

            <button
              onClick={fetchBoard}
              className="p-1.5 rounded text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-colors"
              title="Refresh Matrix"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Hostel Selector Tabs */}
        <div className="flex items-center gap-2 pt-4 overflow-x-auto">
          {board.map((h) => {
            const hBeds = h.floors.reduce(
              (acc, f) => acc + f.rooms.reduce((rAcc, r) => rAcc + r.capacity, 0),
              0
            );
            const hOcc = h.floors.reduce(
              (acc, f) => acc + f.rooms.reduce((rAcc, r) => rAcc + r.occupied_count, 0),
              0
            );
            const isActive = (selectedHostelId || board[0]?.hostel_id) === h.hostel_id;

            return (
              <button
                key={h.hostel_id}
                onClick={() => {
                  setSelectedHostelId(h.hostel_id);
                  setSelectedRoom(null);
                }}
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#1E3A8A] text-white shadow-sm'
                    : 'bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0] hover:bg-[#F1F5F9]'
                }`}
              >
                <span>{h.hostel_name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-medium ${
                    isActive ? 'bg-white/20 text-white' : 'bg-white border border-[#CBD5E1] text-[#0F172A]'
                  }`}
                >
                  {hOcc}/{hBeds}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#DC2626]">
          {error}
        </div>
      )}

      {loading && !activeHostel && (
        <div className="py-16 text-center text-xs text-[#64748B] bg-white border border-[#E2E8F0] rounded-lg">
          Loading hostel floor matrix...
        </div>
      )}

      {activeHostel && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main Matrix: Floors & Rooms */}
          <div className="lg:col-span-2 space-y-4">
            {activeHostel.floors.map((floor) => (
              <div
                key={floor.floor_no}
                className="bg-white border border-[#E2E8F0] rounded-lg p-4 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#2F5BD6]" strokeWidth={1.75} />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                      Floor {floor.floor_no}
                    </h4>
                  </div>
                  <span className="text-xs text-[#64748B] tabular-nums">
                    {floor.rooms.length} Rooms &bull;{' '}
                    {floor.rooms.reduce((acc, r) => acc + r.occupied_count, 0)} /{' '}
                    {floor.rooms.reduce((acc, r) => acc + r.capacity, 0)} Beds Occupied
                  </span>
                </div>

                {/* Rooms Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {floor.rooms.map((room) => {
                    const isFull = room.occupied_count === room.capacity;
                    const isVacant = room.occupied_count === 0;
                    const isSelected = selectedRoom?.room_id === room.room_id;

                    return (
                      <div
                        key={room.room_id}
                        onClick={() => setSelectedRoom(room)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'ring-2 ring-[#2F5BD6] bg-[#EEF2FF] border-[#2F5BD6]'
                            : isFull
                            ? 'bg-[#F0FDF4] border-[#BBF7D0] hover:border-[#86EFAC]'
                            : isVacant
                            ? 'bg-[#F8FAFC] border-[#E2E8F0] hover:border-[#CBD5E1]'
                            : 'bg-[#FFFBEB] border-[#FDE68A] hover:border-[#FCD34D]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-heading font-bold text-xs text-[#0F172A]">
                            {room.room_no}
                          </span>
                          {/* Habit tag */}
                          {room.study_habit_tag ? (
                            <span
                              className={`p-0.5 rounded text-[10px] ${
                                room.study_habit_tag === 'DAY'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}
                              title={`Study Habit: ${room.study_habit_tag}`}
                            >
                              {room.study_habit_tag === 'DAY' ? (
                                <Sun className="w-3 h-3" strokeWidth={2} />
                              ) : (
                                <Moon className="w-3 h-3" strokeWidth={2} />
                              )}
                            </span>
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-300" title="Unassigned habit" />
                          )}
                        </div>

                        {/* Bed occupancy bar & numbers */}
                        <div className="flex items-center justify-between text-[11px] text-[#475569] mb-1">
                          <span className="flex items-center gap-1">
                            <BedDouble className="w-3 h-3" strokeWidth={1.75} />
                            <span>{room.capacity}-Bed</span>
                          </span>
                          <span className="font-semibold tabular-nums">
                            {room.occupied_count}/{room.capacity}
                          </span>
                        </div>

                        {/* Visual bed pip indicators */}
                        <div className="flex gap-1">
                          {Array.from({ length: room.capacity }).map((_, idx) => (
                            <div
                              key={idx}
                              className={`h-1.5 flex-1 rounded-full ${
                                idx < room.occupied_count
                                  ? room.study_habit_tag === 'DAY'
                                    ? 'bg-amber-500'
                                    : 'bg-indigo-500'
                                  : 'bg-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Room Details Sidebar / Inspector */}
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 shadow-sm h-fit space-y-4">
            <div className="border-b border-[#E2E8F0] pb-3">
              <h4 className="font-heading font-semibold text-xs text-[#0F172A] uppercase tracking-wider">
                Room Inspector
              </h4>
              <p className="text-xs text-[#64748B]">Click any room card on the left to inspect beds</p>
            </div>

            {selectedRoom ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                  <div>
                    <div className="text-base font-bold font-heading text-[#0F172A]">
                      Room {selectedRoom.room_no}
                    </div>
                    <div className="text-xs text-[#64748B]">
                      {activeHostel.hostel_name} &bull; Floor {selectedRoom.floor_no}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                        selectedRoom.occupied_count === selectedRoom.capacity
                          ? 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]'
                          : 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]'
                      }`}
                    >
                      {selectedRoom.occupied_count} / {selectedRoom.capacity} Occupied
                    </span>
                  </div>
                </div>

                {/* Habit Enforcement Badge */}
                <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg flex items-center justify-between text-xs">
                  <span className="text-[#64748B]">Enforced Habit Tag:</span>
                  {selectedRoom.study_habit_tag ? (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-semibold text-[11px] ${
                        selectedRoom.study_habit_tag === 'DAY'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      }`}
                    >
                      {selectedRoom.study_habit_tag === 'DAY' ? (
                        <Sun className="w-3.5 h-3.5" strokeWidth={1.75} />
                      ) : (
                        <Moon className="w-3.5 h-3.5" strokeWidth={1.75} />
                      )}
                      <span>{selectedRoom.study_habit_tag === 'DAY' ? 'Day Scholar Only' : 'Night Owl Only'}</span>
                    </span>
                  ) : (
                    <span className="text-[#64748B] italic">Dynamic (Unassigned)</span>
                  )}
                </div>

                {/* Occupants list */}
                <div>
                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-2">
                    Occupants & Allottees
                  </h5>
                  {selectedRoom.occupants && selectedRoom.occupants.length > 0 ? (
                    <div className="space-y-2">
                      {selectedRoom.occupants.map((occ, idx) => (
                        <div
                          key={occ.allotment_id || idx}
                          className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#0F172A]">{occ.name}</span>
                            <span
                              className={`text-[10px] px-2 py-0.2 rounded font-bold uppercase ${
                                occ.response_status === 'ACCEPTED'
                                  ? 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]'
                                  : occ.response_status === 'AWAITING'
                                  ? 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]'
                                  : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
                              }`}
                            >
                              {occ.response_status}
                            </span>
                          </div>
                          <div className="text-[#64748B] flex items-center justify-between font-mono text-[11px]">
                            <span>{occ.roll_no}</span>
                            <span>Bed #{idx + 1}</span>
                          </div>
                          <div className="text-[10px] text-[#64748B]">
                            Allotted: {new Date(occ.allotted_on).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                      No students allotted to this room yet.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                Select a room from the floor matrix to view bed allocations and student details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
