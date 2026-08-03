const STORAGE_KEY = 'miltonLiftBookings';
const form = document.getElementById('bookingForm');
const messageBox = document.getElementById('message');
const availabilitySummary = document.getElementById('availabilitySummary');
const calendarMonthLabel = document.getElementById('calendarMonthLabel');
const calendarGrid = document.getElementById('calendarGrid');
const bookingList = document.getElementById('bookingList');

function setMessage(text, isError = false) {
  messageBox.textContent = text;
  messageBox.className = `message ${isError ? 'error' : 'success'}`;
}

function resetMessage() {
  messageBox.textContent = '';
  messageBox.className = 'message';
}

function getToday() {
  const date = new Date();
  return date.toISOString().split('T')[0];
}

function getDefaultEndDate() {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  return date.toISOString().split('T')[0];
}

function populateDefaultDates() {
  const startInput = form.elements.startDate;
  const endInput = form.elements.endDate;
  startInput.value = getToday();
  endInput.value = getDefaultEndDate();
}

function loadBookings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveBookings(bookings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA <= endB && startB <= endA;
}

function getAvailability(startDate, endDate) {
  const bookings = loadBookings();
  const occupiedDates = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const current = new Date(start);

  while (current <= end) {
    const currentString = current.toISOString().split('T')[0];
    const isOccupied = bookings.some((booking) => {
      const bookingStart = new Date(`${booking.startDate}T00:00:00`);
      const bookingEnd = new Date(`${booking.endDate}T00:00:00`);
      return rangesOverlap(current, current, bookingStart, bookingEnd);
    });

    if (isOccupied) {
      occupiedDates.push(currentString);
    }

    current.setDate(current.getDate() + 1);
  }

  return { occupiedDates, available: occupiedDates.length === 0, range: `${startDate} to ${endDate}` };
}

function renderAvailability() {
  const startDate = form.elements.startDate.value;
  const endDate = form.elements.endDate.value;

  if (!startDate || !endDate) {
    availabilitySummary.innerHTML = 'Choose a date range to see availability.';
    calendarMonthLabel.textContent = 'Calendar';
    calendarGrid.innerHTML = '';
    return;
  }

  const data = getAvailability(startDate, endDate);
  availabilitySummary.innerHTML = data.available
    ? `<strong>${data.range}</strong> is open for booking.`
    : `<strong>${data.range}</strong> overlaps with a current booking.`;

  const baseDate = new Date(`${startDate}T00:00:00`);
  const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const monthEnd = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  const firstDay = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const bookedDates = new Set(loadBookings().flatMap((booking) => {
    const booked = [];
    const start = new Date(`${booking.startDate}T00:00:00`);
    const end = new Date(`${booking.endDate}T00:00:00`);
    const current = new Date(start);
    while (current <= end) {
      booked.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return booked;
  }));

  const selectedDates = new Set();
  const selectedStart = new Date(`${startDate}T00:00:00`);
  const selectedEnd = new Date(`${endDate}T00:00:00`);
  let dayCursor = new Date(selectedStart);
  while (dayCursor <= selectedEnd) {
    selectedDates.add(dayCursor.toISOString().split('T')[0]);
    dayCursor.setDate(dayCursor.getDate() + 1);
  }

  calendarMonthLabel.textContent = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const cells = [];
  for (let i = 0; i < firstDay; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), day);
    cells.push(date);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  calendarGrid.innerHTML = '';
  cells.forEach((cell) => {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';

    if (!cell) {
      dayEl.classList.add('calendar-day--muted');
      calendarGrid.appendChild(dayEl);
      return;
    }

    const dateKey = cell.toISOString().split('T')[0];
    dayEl.textContent = cell.getDate();

    if (bookedDates.has(dateKey)) {
      dayEl.classList.add('calendar-day--booked');
    } else if (selectedDates.has(dateKey)) {
      dayEl.classList.add('calendar-day--selected');
    }

    calendarGrid.appendChild(dayEl);
  });
}

function renderBookings() {
  const bookings = loadBookings();

  if (!bookings.length) {
    bookingList.innerHTML = '<div class="booking-item">No reservations yet. Be the first to book this lift.</div>';
    return;
  }

  bookingList.innerHTML = bookings
    .slice()
    .reverse()
    .map((booking) => `
      <div class="booking-item">
        <strong>${booking.customerName}</strong> • ${booking.startDate} to ${booking.endDate}<br />
        <span class="subtle">Pickup: ${booking.pickupLocation || '8457 NC HWY 62 N, Milton, NC 27305'} • ${booking.paymentStatus || 'paid'}</span>
      </div>
    `)
    .join('');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  resetMessage();

  const payload = Object.fromEntries(new FormData(form).entries());
  const startDate = payload.startDate;
  const endDate = payload.endDate;

  if (!startDate || !endDate || new Date(startDate) > new Date(endDate)) {
    setMessage('Please choose a valid date range.', true);
    return;
  }

  const bookings = loadBookings();
  const conflict = bookings.some((existing) => {
    const existingStart = new Date(`${existing.startDate}T00:00:00`);
    const existingEnd = new Date(`${existing.endDate}T00:00:00`);
    return rangesOverlap(new Date(`${startDate}T00:00:00`), new Date(`${endDate}T00:00:00`), existingStart, existingEnd);
  });

  if (conflict) {
    setMessage('Those dates are already booked. Please choose another range.', true);
    return;
  }

  const booking = {
    id: `booking-${Date.now()}`,
    ...payload,
    paymentStatus: 'paid',
    status: 'confirmed',
    createdAt: new Date().toISOString()
  };

  bookings.push(booking);
  saveBookings(bookings);
  setMessage(`Reservation confirmed for ${payload.startDate} through ${payload.endDate}. Your deposit payment was accepted.`);
  form.reset();
  populateDefaultDates();
  renderAvailability();
  renderBookings();
});

['startDate', 'endDate'].forEach((name) => {
  form.elements[name].addEventListener('change', renderAvailability);
});

populateDefaultDates();
renderAvailability();
renderBookings();
