"""
Grade calculation service for ECOE evaluations.
"""
from decimal import ROUND_HALF_UP, Decimal


def calculate_grade(station, total_points: Decimal) -> Decimal:
    """
    Calculate a grade for a given station and total raw points.

    Algorithm:
    1. If total_points matches an exact GradeScalePoint.raw_points → use that grade.
    2. If below minimum raw_points → clamp to minimum grade.
    3. If above maximum raw_points → clamp to maximum grade.
    4. Otherwise → linear interpolation between the two neighboring scale points.

    Returns a Decimal with 4 decimal places (stored full precision).
    """
    scale_points = list(station.grade_scale.order_by("raw_points"))
    if not scale_points:
        raise ValueError(f"No hay escala de notas definida para la estación '{station.name}'.")

    # Exact match
    for sp in scale_points:
        if sp.raw_points == total_points:
            return sp.grade.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    # Below minimum → return min grade
    if total_points < scale_points[0].raw_points:
        return scale_points[0].grade.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    # Above maximum → return max grade
    if total_points > scale_points[-1].raw_points:
        return scale_points[-1].grade.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    # Linear interpolation
    lower = None
    upper = None
    for i in range(len(scale_points) - 1):
        if scale_points[i].raw_points <= total_points <= scale_points[i + 1].raw_points:
            lower = scale_points[i]
            upper = scale_points[i + 1]
            break

    if lower is None or upper is None:
        # Fallback: return max grade
        return scale_points[-1].grade.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    raw_range = upper.raw_points - lower.raw_points
    if raw_range == Decimal("0"):
        return lower.grade.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    grade_range = upper.grade - lower.grade
    grade = lower.grade + (total_points - lower.raw_points) / raw_range * grade_range

    # Clamp to scale [min, max]
    min_grade = min(sp.grade for sp in scale_points)
    max_grade = max(sp.grade for sp in scale_points)
    grade = max(min_grade, min(grade, max_grade))

    return grade.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def calculate_final_grade(exam) -> list[dict]:
    """
    Calculate final grades for all students in an exam.

    Returns a list of dicts:
    [
        {
            'student': <Student>,
            'station_grades': {station_id: Decimal},
            'final_grade': Decimal | None,
            'approved': bool | None,
        },
        ...
    ]
    """
    active_stations = list(exam.stations.filter(is_active=True).order_by("order", "id"))
    exam_students = exam.exam_students.select_related("student").order_by(
        "student__full_name"
    )

    results = []
    for es in exam_students:
        student = es.student
        station_grades: dict[int, Decimal] = {}
        weighted_sum = Decimal("0")
        total_weight = Decimal("0")

        for station in active_stations:
            eval_obj = (
                exam.evaluations.filter(
                    station=station, student=student, status="FINAL"
                )
                .first()
            )
            if eval_obj and eval_obj.grade is not None:
                grade_rounded = eval_obj.grade.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                station_grades[station.id] = grade_rounded
                weighted_sum += eval_obj.grade * (station.weight_percent / Decimal("100"))
                total_weight += station.weight_percent

        if total_weight > Decimal("0"):
            final_grade = weighted_sum.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            approved = final_grade >= Decimal("4.0")
        else:
            final_grade = None
            approved = None

        results.append(
            {
                "student": student,
                "station_grades": station_grades,
                "final_grade": final_grade,
                "approved": approved,
            }
        )

    return results
