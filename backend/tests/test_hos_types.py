from datetime import datetime

from hos.types import Segment


def test_segment_duration():
    s = Segment("driving", datetime(2026, 1, 1, 8), datetime(2026, 1, 1, 11, 30), "I-80", "")
    assert s.duration_hours() == 3.5
