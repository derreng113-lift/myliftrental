const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;
const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');
const bookingsFile = path.join(dataDir, 'bookings.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(bookingsFile)) {
  fs.writeFileSync(bookingsFile, '[]', 'utf8');
}

function readBookings() {
  try {
    const data = fs.readFileSync(bookingsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function saveBookings(bookings) {
  fs.writeFileSync(bookingsFile, JSON.stringify(bookings, null, 2), 'utf8');
}

function parseDateOnly(value) {
  const date = new Date(`${value}T00:00:00`);
  return date;
}

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA <= endB && startB <= endA;
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(500);
      res.end('Server error');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (req.method === 'GET' && pathname === '/api/bookings') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(readBookings()));
    return;
  }

  if (req.method === 'GET' && pathname === '/api/availability') {
    const startDate = parsedUrl.searchParams.get('startDate');
    const endDate = parsedUrl.searchParams.get('endDate');
    const bookings = readBookings();

    if (!startDate || !endDate) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'startDate and endDate are required' }));
      return;
    }

    const start = parseDateOnly(startDate);
    const end = parseDateOnly(endDate);
    const occupiedDates = [];

    const current = new Date(start);
    while (current <= end) {
      const currentString = current.toISOString().split('T')[0];
      const isOccupied = bookings.some((booking) => {
        const bookingStart = parseDateOnly(booking.startDate);
        const bookingEnd = parseDateOnly(booking.endDate);
        return rangesOverlap(current, current, bookingStart, bookingEnd);
      });

      if (isOccupied) {
        occupiedDates.push(currentString);
      }

      current.setDate(current.getDate() + 1);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ occupiedDates, available: occupiedDates.length === 0, range: `${startDate} to ${endDate}` }));
    return;
  }

  if (req.method === 'POST' && pathname === '/api/bookings') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const booking = JSON.parse(body);
        const bookings = readBookings();

        if (!booking.customerName || !booking.customerEmail || !booking.startDate || !booking.endDate) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required fields' }));
          return;
        }

        const start = parseDateOnly(booking.startDate);
        const end = parseDateOnly(booking.endDate);
        const conflict = bookings.some((existing) => {
          const existingStart = parseDateOnly(existing.startDate);
          const existingEnd = parseDateOnly(existing.endDate);
          return rangesOverlap(start, end, existingStart, existingEnd);
        });

        if (conflict) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Selected dates are already booked. Please pick another range.' }));
          return;
        }

        const newBooking = {
          id: `booking-${Date.now()}`,
          ...booking,
          createdAt: new Date().toISOString(),
          paymentStatus: booking.paymentStatus || 'paid',
          status: 'confirmed'
        };

        bookings.push(newBooking);
        saveBookings(bookings);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, booking: newBooking }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  const extension = path.extname(pathname);
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
  };

  if (extension && contentTypes[extension]) {
    const filePath = path.join(rootDir, pathname === '/' ? 'index.html' : pathname);
    serveFile(res, filePath, contentTypes[extension]);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(port, () => {
  console.log(`Milton Lift booking site running at http://localhost:${port}`);
});
