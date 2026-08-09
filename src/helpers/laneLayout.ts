export type TimelineLaneDescriptor = {
  id: string;
  label: string;
  color: string | null;
};

export type TimelineLaneGeometry = TimelineLaneDescriptor & {
  cross: number;
  pitch: number;
  localRowOffset: number;
};

export type TimelineLaneLayoutEvent = {
  id: string;
  laneId: string;
  startYear: number;
  endYear: number;
  priority: number;
};

export type TimelineLanePlacement = {
  laneId: string;
  cross: number;
};

export type CollapsedTimelineLaneGroup = {
  id: string;
  laneId: string;
  cross: number;
  year: number;
  eventIds: string[];
};

const LANE_EDGE_PADDING = 96;
const LANE_MAX_PITCH = 180;
/** Keeps lane markers and their local sub-rows clear of the central ruler. */
const LANE_RULER_CLEARANCE = 132;
const LANE_MIN_LOCAL_ROW_OFFSET = 30;
const LANE_MAX_LOCAL_ROW_OFFSET = 52;
const LOCAL_LEVELS = [0, -1, 1] as const;

export const buildTimelineLaneGeometry = (
  lanes: TimelineLaneDescriptor[],
  crossSize: number,
): TimelineLaneGeometry[] => {
  if (lanes.length === 0) return [];

  const usableCrossSize = Math.max(0, crossSize - LANE_EDGE_PADDING * 2);
  const maxCross = Math.max(
    LANE_RULER_CLEARANCE,
    usableCrossSize / 2,
  );
  const topLaneCount = Math.ceil(lanes.length / 2);
  const bottomLaneCount = Math.floor(lanes.length / 2);
  const distributeBank = (
    count: number,
    from: number,
    to: number,
    singleCross: number,
  ): number[] => {
    if (count === 0) return [];
    if (count === 1) return [singleCross];
    return Array.from(
      { length: count },
      (_, index) => from + ((to - from) * index) / (count - 1),
    );
  };
  const crosses = [
    ...distributeBank(
      topLaneCount,
      -maxCross,
      -LANE_RULER_CLEARANCE,
      -LANE_RULER_CLEARANCE,
    ),
    ...distributeBank(
      bottomLaneCount,
      LANE_RULER_CLEARANCE,
      maxCross,
      LANE_RULER_CLEARANCE,
    ),
  ];
  const pitch = Math.min(
    LANE_MAX_PITCH,
    crosses.length <= 1
      ? LANE_MAX_PITCH
      : Math.min(
          ...crosses.slice(1).map((cross, index) => cross - crosses[index]),
        ),
  );
  const localRowOffset = Math.max(
    LANE_MIN_LOCAL_ROW_OFFSET,
    Math.min(LANE_MAX_LOCAL_ROW_OFFSET, pitch * 0.28),
  );

  return lanes.map((lane, index) => ({
    ...lane,
    cross: crosses[index],
    pitch,
    localRowOffset,
  }));
};

export const packTimelineLaneEvents = ({
  lanes,
  crossSize,
  minDistanceYears,
  events,
}: {
  lanes: TimelineLaneDescriptor[];
  crossSize: number;
  minDistanceYears: number;
  events: TimelineLaneLayoutEvent[];
}): {
  geometry: TimelineLaneGeometry[];
  placements: Map<string, TimelineLanePlacement>;
  collapsed: CollapsedTimelineLaneGroup[];
} => {
  const geometry = buildTimelineLaneGeometry(lanes, crossSize);
  const geometryById = new Map(geometry.map((lane) => [lane.id, lane]));
  const occupiedByLane = new Map<
    string,
    Array<{ startYear: number; endYear: number; level: number }>
  >();
  const placements = new Map<string, TimelineLanePlacement>();
  const collapsed: CollapsedTimelineLaneGroup[] = [];

  const sortedEvents = [...events].sort((left, right) => {
    const priorityDiff = right.priority - left.priority;
    return priorityDiff !== 0 ? priorityDiff : left.id.localeCompare(right.id);
  });

  for (const event of sortedEvents) {
    const lane = geometryById.get(event.laneId);
    if (!lane) continue;

    const occupied = occupiedByLane.get(lane.id) ?? [];
    occupiedByLane.set(lane.id, occupied);

    const level = LOCAL_LEVELS.find(
      (candidateLevel) =>
        !occupied.some(
          (entry) =>
            entry.level === candidateLevel &&
            event.startYear < entry.endYear + minDistanceYears &&
            entry.startYear < event.endYear + minDistanceYears,
        ),
    );

    if (level !== undefined) {
      occupied.push({
        startYear: event.startYear,
        endYear: event.endYear,
        level,
      });
      placements.set(event.id, {
        laneId: lane.id,
        cross: lane.cross + level * lane.localRowOffset,
      });
      continue;
    }

    const year = (event.startYear + event.endYear) / 2;
    const existingGroup = collapsed.find(
      (group) =>
        group.laneId === lane.id &&
        Math.abs(group.year - year) < minDistanceYears,
    );

    if (existingGroup) {
      existingGroup.eventIds.push(event.id);
    } else {
      collapsed.push({
        id: `${lane.id}:${event.id}:collapsed`,
        laneId: lane.id,
        cross: lane.cross,
        year,
        eventIds: [event.id],
      });
    }
  }

  return { geometry, placements, collapsed };
};
