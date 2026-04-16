using UnityEngine;
using System.Collections.Generic;

namespace Fangame.Map
{
    public class MarchPathVisualizer : MonoBehaviour
    {
        public static MarchPathVisualizer Instance { get; private set; }

        [Header("Visuals")]
        public LineRenderer lineRenderer;
        public float lineOffset = 0.5f; // Elevation above map

        [Header("Colors")]
        public Color attackColor = Color.red;
        public Color reinforceColor = Color.blue;
        public Color occupyColor = Color.green;

        public enum PathType { Attack, Reinforce, Occupy }

        private void Awake()
        {
            Instance = this;
            if (lineRenderer == null) lineRenderer = GetComponent<LineRenderer>();
            ClearPath();
        }

        public void DrawPath(List<Vector2Int> hexCoords, PathType type)
        {
            if (hexCoords == null || hexCoords.Count < 2) 
            {
                ClearPath();
                return;
            }

            lineRenderer.positionCount = hexCoords.Count;
            lineRenderer.startColor = GetColor(type);
            lineRenderer.endColor = GetColor(type);

            for (int i = 0; i < hexCoords.Count; i++)
            {
                Vector3 worldPos = HexUtils.AxialToWorld(hexCoords[i].x, hexCoords[i].y);
                worldPos.y += lineOffset;
                lineRenderer.SetPosition(i, worldPos);
            }

            lineRenderer.enabled = true;
        }

        public void ClearPath()
        {
            if (lineRenderer != null) lineRenderer.enabled = false;
        }

        private Color GetColor(PathType type)
        {
            switch (type)
            {
                case PathType.Attack: return attackColor;
                case PathType.Reinforce: return reinforceColor;
                case PathType.Occupy: return occupyColor;
                default: return occupyColor;
            }
        }
    }
}
