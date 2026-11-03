import React, { useState, useEffect } from 'react';
import {
  Building2,
  BedDouble,
  Sun,
  Moon,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { HostelBoard, RoomBoardItem } from '../types.js';

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
    <div className="space-y-6">
      {/* Board Header & Metrics */}
      <div className="bg-surface border-2 border-black rounded-sm p-6 shadow-hard-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-black">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-paper border-2 border-black flex items-center justify-center text-ink-primary shadow-hard-sm">
              <Building2 className="w-5 h-5 text-ink-primary" strokeWidth={2} />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-xl text-ink-primary tracking-tight">Hostel Room Occupancy Board</h3>
              <p className="text-xs font-medium text-ink-secondary">Real-time visual floor & bed allocation matrix</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs bg-surface border-2 border-black px-3.5 py-2 rounded-sm shadow-hard-sm">
              <span className="font-bold text-ink-secondary">Total Capacity:</span>
              <span className="font-extrabold text-ink-primary font-mono tabular-nums">
                {occupiedBeds} / {totalBeds} Beds ({totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0}%)
              </span>
            </div>

            <button
              onClick={fetchBoard}
              className="p-2 rounded-sm text-ink-primary bg-surface hover:bg-paper border-2 border-black shadow-hard-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              title="Refresh Matrix"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Hostel Selector Tabs */}
        <div className="flex items-center gap-2.5 pt-4 overflow-x-auto">
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
                className={`px-4 py-2 rounded-sm text-xs font-extrabold flex items-center gap-2 border-2 border-black transition-all ${
                  isActive
                    ? 'bg-saffron text-black shadow-hard-sm translate-x-0.5 translate-y-0.5'
                    : 'bg-surface text-ink-primary shadow-hard hover:bg-paper active:translate-x-1 active:translate-y-1 active:shadow-none'
                }`}
              >
                <span>{h.hostel_name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-sm font-mono font-bold border border-black ${
                    isActive ? 'bg-surface text-black' : 'bg-surface-subtle text-ink-primary'
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
        <div className="p-4 bg-status-danger-subtle border-2 border-black rounded-sm text-xs font-bold text-status-danger-text shadow-hard-sm">
          {error}
        </div>
      )}

      {loading && !activeHostel && (
        <div className="py-16 text-center text-xs font-bold text-ink-muted bg-surface border-2 border-black rounded-sm shadow-hard">
          Loading hostel floor matrix...
        </div>
      )}

      {activeHostel && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Matrix: Floors & Rooms */}
          <div className="lg:col-span-2 space-y-5">
            {activeHostel.floors.map((floor) => (
              <div
                key={floor.floor_no}
                className="bg-surface border-2 border-black rounded-sm p-5 shadow-hard space-y-4"
              >
                <div className="flex items-center justify-between border-b-2 border-black pb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-ink-primary" strokeWidth={2} />
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-ink-primary">
                      Floor {floor.floor_no}
                    </h4>
                  </div>
                  <span className="text-xs font-bold text-ink-secondary tabular-nums">
                    {floor.rooms.length} Rooms &bull;{' '}
                    {floor.rooms.reduce((acc, r) => acc + r.occupied_count, 0)} /{' '}
                    {floor.rooms.reduce((acc, r) => acc + r.capacity, 0)} Beds Occupied
                  </span>
                </div>

                {/* Rooms Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {floor.rooms.map((room) => {
                    const isFull = room.occupied_count === room.capacity;
                    const isVacant = room.occupied_count === 0;
                    const isSelected = selectedRoom?.room_id === room.room_id;

                    return (
                      <div
                        key={room.room_id}
                        onClick={() => setSelectedRoom(room)}
                        className={`p-3 rounded-sm border-2 border-black cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-paper shadow-hard ring-2 ring-black -translate-y-0.5'
                            : isFull
                            ? 'bg-status-success-subtle shadow-hard-sm hover:translate-x-0.5 hover:translate-y-0.5'
                            : isVacant
                            ? 'bg-surface shadow-hard-sm hover:translate-x-0.5 hover:translate-y-0.5'
                            : 'bg-status-warning-subtle shadow-hard-sm hover:translate-x-0.5 hover:translate-y-0.5'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-heading font-extrabold text-xs text-ink-primary">
                            {room.room_no}
                          </span>
                          {/* Habit tag */}
                          {room.study_habit_tag ? (
                            <span
                              className={`p-1 rounded-sm border border-black text-[10px] ${
                                room.study_habit_tag === 'DAY'
                                  ? 'bg-paper text-black'
                                  : 'bg-surface-subtle text-black'
                              }`}
                              title={`Study Habit: ${room.study_habit_tag}`}
                            >
                              {room.study_habit_tag === 'DAY' ? (
                                <Sun className="w-3 h-3" strokeWidth={2.5} />
                              ) : (
                                <Moon className="w-3 h-3" strokeWidth={2.5} />
                              )}
                            </span>
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-full bg-surface-muted border border-black" title="Unassigned habit" />
                          )}
                        </div>

                        {/* Bed occupancy bar & numbers */}
                        <div className="flex items-center justify-between text-[11px] font-bold text-ink-secondary mb-1.5">
                          <span className="flex items-center gap-1">
                            <BedDouble className="w-3.5 h-3.5" strokeWidth={2} />
                            <span>{room.capacity}-Bed</span>
                          </span>
                          <span className="font-extrabold font-mono tabular-nums text-ink-primary">
                            {room.occupied_count}/{room.capacity}
                          </span>
                        </div>

                        {/* Visual bed pip indicators */}
                        <div className="flex gap-1.5">
                          {Array.from({ length: room.capacity }).map((_, idx) => (
                            <div
                              key={idx}
                              className={`h-2 flex-1 rounded-sm border border-black ${
                                idx < room.occupied_count
                                  ? room.study_habit_tag === 'DAY'
                                    ? 'bg-saffron'
                                    : 'bg-navy-sidebar'
                                  : 'bg-surface'
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
          <div className="bg-surface border-2 border-black rounded-sm p-5 shadow-hard-lg h-fit space-y-4">
            <div className="border-b-2 border-black pb-3">
              <h4 className="font-heading font-extrabold text-xs text-ink-primary uppercase tracking-wider">
                Room Inspector
              </h4>
              <p className="text-xs font-medium text-ink-secondary">Click any room card on the left to inspect beds</p>
            </div>

            {selectedRoom ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 bg-paper border-2 border-black rounded-sm shadow-hard-sm">
                  <div>
                    <div className="text-base font-extrabold font-heading text-ink-primary">
                      Room {selectedRoom.room_no}
                    </div>
                    <div className="text-xs font-medium text-ink-secondary">
                      {activeHostel.hostel_name} &bull; Floor {selectedRoom.floor_no}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-sm border-2 border-black text-[11px] font-extrabold shadow-hard-sm ${
                        selectedRoom.occupied_count === selectedRoom.capacity
                          ? 'bg-status-success-subtle text-status-success-text'
                          : 'bg-status-warning-subtle text-status-warning-text'
                      }`}
                    >
                      {selectedRoom.occupied_count} / {selectedRoom.capacity} Occupied
                    </span>
                  </div>
                </div>

                {/* Habit Enforcement Badge */}
                <div className="p-3 bg-surface border-2 border-black rounded-sm shadow-hard-sm flex items-center justify-between text-xs">
                  <span className="font-bold text-ink-secondary">Enforced Habit Tag:</span>
                  {selectedRoom.study_habit_tag ? (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border-2 border-black font-extrabold text-[11px] shadow-hard-sm ${
                        selectedRoom.study_habit_tag === 'DAY'
                          ? 'bg-paper text-black'
                          : 'bg-surface-subtle text-black'
                      }`}
                    >
                      {selectedRoom.study_habit_tag === 'DAY' ? (
                        <Sun className="w-3.5 h-3.5" strokeWidth={2} />
                      ) : (
                        <Moon className="w-3.5 h-3.5" strokeWidth={2} />
                      )}
                      <span>{selectedRoom.study_habit_tag === 'DAY' ? 'Day Scholar Only' : 'Night Owl Only'}</span>
                    </span>
                  ) : (
                    <span className="text-ink-muted italic font-medium">Dynamic (Unassigned)</span>
                  )}
                </div>

                {/* Occupants list */}
                <div>
                  <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-secondary mb-2">
                    Occupants & Allottees
                  </h5>
                  {selectedRoom.occupants && selectedRoom.occupants.length > 0 ? (
                    <div className="space-y-2.5">
                      {selectedRoom.occupants.map((occ, idx) => (
                        <div
                          key={occ.allotment_id || idx}
                          className="p-3 bg-surface border-2 border-black rounded-sm shadow-hard-sm text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-ink-primary">{occ.name}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-sm font-extrabold uppercase border-2 border-black ${
                                occ.response_status === 'ACCEPTED'
                                  ? 'bg-status-success-subtle text-status-success-text'
                                  : occ.response_status === 'AWAITING'
                                  ? 'bg-saffron text-black'
                                  : 'bg-status-danger-subtle text-status-danger-text'
                              }`}
                            >
                              {occ.response_status}
                            </span>
                          </div>
                          <div className="text-ink-secondary flex items-center justify-between font-mono text-[11px] font-bold">
                            <span>{occ.roll_no}</span>
                            <span>Bed #{idx + 1}</span>
                          </div>
                          <div className="text-[10px] font-mono text-ink-muted">
                            Allotted: {new Date(occ.allotted_on).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs font-bold text-ink-muted bg-surface border-2 border-black rounded-sm shadow-hard-sm">
                      No students allotted to this room yet.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-xs font-bold text-ink-muted bg-surface border-2 border-black rounded-sm shadow-hard-sm">
                Select a room from the floor matrix to view bed allocations and student details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
