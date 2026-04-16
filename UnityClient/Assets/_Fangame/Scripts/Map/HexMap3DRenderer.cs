using UnityEngine;
using System.Collections.Generic;

namespace Fangame.Map
{
    /// <summary>
    /// AAA 3D Environment Generator.
    /// Reads 2D tile data from the backend and converts it into a rich 3D hex terrain.
    /// This replaces the 2D canvas map with actual meshes, ready for lighting and fog.
    /// </summary>
    public class HexMap3DRenderer : MonoBehaviour
    {
        [Header("Prefabs")]
        public GameObject defaultHexPrefab;
        public GameObject mountainHexPrefab;
        public GameObject forestHexPrefab;
        public GameObject waterHexPrefab; // Can have a custom shader with wave motion

        [Header("Generation Settings")]
        public Transform mapContainer;
        public float hexOuterRadius = 1f;

        private Dictionary<Vector2Int, GameObject> _spawnedHexes = new Dictionary<Vector2Int, GameObject>();

        // Simulating receiving bulk tile data from the server
        public void BuildMap(List<TileDataDto> tiles)
        {
            ClearMap();

            foreach (var tile in tiles)
            {
                SpawnHex(tile.q, tile.r, tile.type);
            }

            Debug.Log($"HexMap3DRenderer: Instantiated {tiles.Count} 3D Hexes.");
        }

        private void SpawnHex(int q, int r, string tileType)
        {
            GameObject prefab = GetPrefabForType(tileType);
            
            // Assuming HexUtils exists and has a method mapping Axial (q,r) to World Position
            Vector3 worldPos = HexUtils.AxialToWorld(q, r, hexOuterRadius);
            
            // Add a slight randomization to Y rotation for organic look (forests/mountains)
            Quaternion rotation = Quaternion.Euler(0, Random.Range(0, 6) * 60f, 0);

            GameObject hexObj = Instantiate(prefab, worldPos, rotation, mapContainer);
            _spawnedHexes[new Vector2Int(q, r)] = hexObj;

            // AAA Polish: Spawn animation
            // E.g. pop in from below the ground plane when rendering for the first time
            hexObj.transform.position = worldPos + Vector3.down * 5f;
            StartCoroutine(MapRiseTween(hexObj.transform, worldPos, Random.Range(0.1f, 0.5f)));
        }

        private GameObject GetPrefabForType(string type)
        {
            switch (type)
            {
                case "mountain": return mountainHexPrefab;
                case "forest":   return forestHexPrefab;
                case "water":    return waterHexPrefab;
                default:         return defaultHexPrefab;
            }
        }

        private void ClearMap()
        {
            foreach (Transform child in mapContainer)
            {
                Destroy(child.gameObject);
            }
            _spawnedHexes.Clear();
        }

        // Lightweight animation specifically for map building
        private System.Collections.IEnumerator MapRiseTween(Transform target, Vector3 targetPos, float delay)
        {
            yield return new WaitForSeconds(delay);

            float duration = 0.5f;
            float elapsed = 0f;
            Vector3 startPos = target.position;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / duration;
                
                // Ease out
                t = Mathf.Sin(t * Mathf.PI * 0.5f);

                target.position = Vector3.Lerp(startPos, targetPos, t);
                yield return null;
            }
            target.position = targetPos;
        }

        [System.Serializable]
        public class TileDataDto
        {
            public int q;
            public int r;
            public string type;
        }
    }
}
