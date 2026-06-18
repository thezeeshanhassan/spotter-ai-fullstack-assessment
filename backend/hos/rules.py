"""FMCSA Hours-of-Service constants for property-carrying CMV drivers.

Source: Interstate Truck Driver's Guide to Hours of Service (49 CFR part 395).
All durations are in hours; distances in miles.
"""

# Driving / duty limits
MAX_DRIVE_HOURS = 11.0          # 11-hour driving limit (§395.3(a)(3))
MAX_DUTY_WINDOW_HOURS = 14.0    # 14-hour driving window (§395.3(a)(2))
BREAK_AFTER_DRIVE_HOURS = 8.0   # 30-min break required after 8h cumulative driving
BREAK_DURATION_HOURS = 0.5      # required break length (§395.3(a)(3)(ii))
RESET_OFF_HOURS = 10.0          # 10 consecutive off-duty hours reset 11h/14h clocks
CYCLE_LIMIT_HOURS = 70.0        # 70-hour/8-day on-duty limit (§395.3(b))
RESTART_OFF_HOURS = 34.0        # 34-hour restart resets the weekly cycle (§395.3(c))

# Trip-specific assumptions (from the assessment brief)
PICKUP_HOURS = 1.0             # 1 hour on-duty (not driving) for pickup
DROPOFF_HOURS = 1.0           # 1 hour on-duty (not driving) for dropoff
FUEL_INTERVAL_MILES = 1000.0  # fuel at least once every 1,000 miles
FUEL_DURATION_HOURS = 0.5     # on-duty (not driving) time per fuel stop
AVG_SPEED_MPH = 55.0         # fallback speed when ORS duration is unavailable

# Duty statuses (match the DOT log grid rows)
OFF_DUTY = "off_duty"
SLEEPER = "sleeper"
DRIVING = "driving"
ON_DUTY = "on_duty"
