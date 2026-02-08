import React from 'react';

const TimeSlotCell = ({ appointmentsCount }) => {
  const maxAppointments = 5;
  const availableSlots = maxAppointments - appointmentsCount;

  const getBackgroundColor = () => {
    if (availableSlots === 0) return 'bg-red-200';
    if (availableSlots === 1) return 'bg-orange-200';
    if (availableSlots === 2) return 'bg-yellow-200';
    if (availableSlots === 3) return 'bg-green-200';
    if (availableSlots === 4) return 'bg-turquoise-200';
    return 'bg-turquoise-100'; // 5 available
  };

  return (
    <div className={`border h-24 flex items-center justify-center ${getBackgroundColor()}`}>
      <span className="font-bold text-lg text-gray-700">{availableSlots}</span>
    </div>
  );
};

export default TimeSlotCell;