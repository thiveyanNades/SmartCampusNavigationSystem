import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Dimensions,
  Image,
  StyleSheet,
  Switch,
  Text,
  View,
  Animated,
  Easing,
  TouchableOpacity,
} from "react-native";
import ImageZoom from "react-native-image-pan-zoom";
import Svg, { Circle, Polyline } from "react-native-svg";

/* =======================
   TYPES
======================= */
type GraphNode = {
  id: string;
  x: number;
  y: number;
  floor: number;
};

type Edge = {
  target: string;
  weight: number;
};

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* =======================
   DIJKSTRA (SAFE)
======================= */
function dijkstra(
  nodes: GraphNode[],
  edges: Record<string, Edge[]>,
  startId: string,
  endId: string
): string[] {
  const distances: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const unvisited = new Set(nodes.map((n) => n.id));

  nodes.forEach((n) => {
    distances[n.id] = Infinity;
    prev[n.id] = null;
  });

  distances[startId] = 0;

  while (unvisited.size > 0) {
    let current = Array.from(unvisited).reduce((a, b) =>
      distances[a] < distances[b] ? a : b
    );

    if (distances[current] === Infinity) break;
    unvisited.delete(current);

    if (current === endId) break;

    (edges[current] || []).forEach(({ target, weight }) => {
      const alt = distances[current] + weight;
      if (alt < distances[target]) {
        distances[target] = alt;
        prev[target] = current;
      }
    });
  }

  const path: string[] = [];
  let u: string | null = endId;

  while (u) {
    path.unshift(u);
    u = prev[u];
  }

  return path;
}

/* =======================
   COMPONENT
======================= */
export default function CampusMap() {
  const [accessibilityMode, setAccessibilityMode] = useState(false);
  const [floorPaths, setFloorPaths] = useState<
    Record<number, { x: number; y: number }[]>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [currentFloor, setCurrentFloor] = useState(1);
  const [isSimulating, setIsSimulating] = useState(false);

  const imageZoomRef = useRef<any>(null);
  const locationAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const imageWidth = 800;
  const imageHeight = 600;

  const scaleToFit = Math.min(
    screenWidth / imageWidth,
    screenHeight / imageHeight
  );

  /* =======================
     MARKERS
  ======================= */
  const floor1Markers = [
    { x: 200, y: 420 },
    { x: 125, y: 390 },
  ];

  const floor2Markers = [
    { x: 105, y: 350 },
    { x: 370, y: 425 },
  ];

  const floor4Markers = [
    { x: 150, y: 300 },
    { x: 400, y: 320 },
  ];

  /* =======================
     GRAPH DATA (FLOOR 4)
  ======================= */
  const allNodes: GraphNode[] = [
    { id: "N1", x: 700, y: 295, floor: 4 },
    { id: "N2", x: 700, y: 195, floor: 4 },
    { id: "N3", x: 460, y: 195, floor: 4 },
    { id: "N4", x: 350, y: 195, floor: 4 },
    { id: "N5", x: 350, y: 215, floor: 4 },
    { id: "N6", x: 425, y: 215, floor: 4 },
    { id: "N7", x: 425, y: 260, floor: 4 },
    { id: "N8", x: 350, y: 260, floor: 4 },
    { id: "N9", x: 455, y: 260, floor: 4 },
    { id: "N10", x: 455, y: 280, floor: 4 },
    { id: "N11", x: 480, y: 385, floor: 4 },
    { id: "N12", x: 695, y: 385, floor: 4 },
  ];

  const edges: Record<string, Edge[]> = {
    N1: [{ target: "N2", weight: 25 }, { target: "N12", weight: 10 }],
    N2: [{ target: "N1", weight: 25 }, { target: "N3", weight: 120 }],
    N3: [{ target: "N2", weight: 120 }, { target: "N4", weight: 50 }, { target: "N9", weight: 20 }],
    N4: [{ target: "N3", weight: 50 }, { target: "N5", weight: 2 }],
    N5: [{ target: "N4", weight: 2 }, { target: "N6", weight: 10 }, { target: "N8", weight: 5 }],
    N6: [{ target: "N5", weight: 10 }, { target: "N7", weight: 5 }],
    N7: [{ target: "N6", weight: 5 }, { target: "N8", weight: 10 }, { target: "N9", weight: 2 }],
    N8: [{ target: "N5", weight: 5 }, { target: "N7", weight: 10 }],
    N9: [{ target: "N3", weight: 20 }, { target: "N7", weight: 2 }, { target: "N10", weight: 1 }],
    N10: [{ target: "N9", weight: 1 }, { target: "N11", weight: 12 }],
    N11: [{ target: "N10", weight: 12 }, { target: "N12", weight: 100 }],
    N12: [{ target: "N11", weight: 100 }, { target: "N1", weight: 10 }],
  };

  const nodesOnCurrentFloor = allNodes.filter(
    (n) => n.floor === currentFloor
  );

  const edgesOnCurrentFloor: Record<string, Edge[]> = {};
  nodesOnCurrentFloor.forEach((n) => {
    edgesOnCurrentFloor[n.id] = (edges[n.id] || []).filter((e) =>
      nodesOnCurrentFloor.some((x) => x.id === e.target)
    );
  });

  /* =======================
     ANIMATION
  ======================= */
  const traversePath = (points: { x: number; y: number }[]) => {
    if (!points || points.length < 2) return;

    locationAnim.setValue(points[0]);
    setIsSimulating(true);

    const anims = points.slice(1).map((p) =>
      Animated.timing(locationAnim, {
        toValue: p,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );

    Animated.sequence(anims).start();
  };

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 800, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  /* =======================
     RUN DIJKSTRA
  ======================= */
  const runDijkstra4thFloor = () => {
    const startId = "N1";
    const endId = "N11";

    const floor4Nodes = allNodes.filter(n => n.floor === 4);

    const floor4Edges: Record<string, Edge[]> = {};
    floor4Nodes.forEach(n => {
      floor4Edges[n.id] = (edges[n.id] || []).filter(e =>
        floor4Nodes.some(x => x.id === e.target)
      );
    });

    const ids = dijkstra(
      floor4Nodes,
      floor4Edges,
      startId,
      endId
    );

    console.log("Dijkstra path IDs:", ids);

    const coords = ids
      .map(id => floor4Nodes.find(n => n.id === id))
      .filter((n): n is GraphNode => n !== undefined);

    if (coords.length < 2) return;

    setCurrentFloor(4);
    setFloorPaths(prev => ({ ...prev, 4: coords }));
    traversePath(coords);
  };


  const markers =
    currentFloor === 1 ? floor1Markers :
    currentFloor === 2 ? floor2Markers :
    [];

  const currentPathPoints = floorPaths[currentFloor] || [];

  /* =======================
     RENDER
  ======================= */
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.floorButtons}>
        <Button title="1st Floor" onPress={() => setCurrentFloor(1)} />
        <Button title="2nd Floor" onPress={() => setCurrentFloor(2)} />
        <Button title="4th Floor (Dijkstra)" onPress={runDijkstra4thFloor} />
      </View>

      <ImageZoom
        ref={imageZoomRef}
        cropWidth={screenWidth}
        cropHeight={screenHeight}
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        minScale={scaleToFit}
        maxScale={3}
      >
        <View>
          <Image
            source={
              currentFloor === 1
                ? require("../../assets/images/CampusMapEng1stFloor.png")
                : currentFloor === 2
                ? require("../../assets/images/CampusMapEng2ndFloor.png")
                : require("../../assets/images/CampusMapEng4thFloor.png")
            }
            style={{ width: imageWidth, height: imageHeight }}
          />

          <Svg width={imageWidth} height={imageHeight} style={{ position: "absolute" }}>
            {/* Path */}
            {currentPathPoints.length > 1 && (
              <Polyline
                points={currentPathPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="red"
                strokeWidth={4}
              />
            )}

            {/* Nodes */}
            {nodesOnCurrentFloor.map((n) => (
              <Circle key={n.id} cx={n.x} cy={n.y} r={5} fill="purple" />
            ))}

            {/* Markers */}
            {markers.map((m, i) => (
              <Circle key={i} cx={m.x} cy={m.y} r={10} fill="blue" />
            ))}

            {/* Animated dot */}
            {isSimulating && (
              <AnimatedCircle
                cx={locationAnim.x}
                cy={locationAnim.y}
                r={12}
                fill="dodgerblue"
              />
            )}

            {Object.entries(edgesOnCurrentFloor).map(([fromId, edgeList]) =>
              edgeList.map((e, i) => {
                const from = nodesOnCurrentFloor.find(n => n.id === fromId);
                const to = nodesOnCurrentFloor.find(n => n.id === e.target);
                if (!from || !to) return null;

                return (
                  <Polyline
                    key={`${fromId}-${i}`}
                    points={`${from.x},${from.y} ${to.x},${to.y}`}
                    stroke="green"
                    strokeWidth={2}
                    strokeDasharray="4,4"
                  />
                );
              })
            )}

          </Svg>
        </View>
      </ImageZoom>
    </View>
  );
}

/* =======================
   STYLES
======================= */
const styles = StyleSheet.create({
  floorButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 40,
  },
});
