using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Fangame.Networking;
using Newtonsoft.Json;

namespace Fangame.Map
{
    /// <summary>
    /// Master controller for the interactive World Map.
    /// Manages data fetching, rendering, and active marches.
    /// </summary>
    public class WorldMapController : MonoBehaviour
    {
        public static WorldMapController Instance { get; private set; }

        [Header("References")]
        public HexMapRenderer mapRenderer;
        public TileInspectorPanel tileInspector;
        public MarchOverlayRenderer marchOverlay;
        
        [Header("Settings")]
        public float refreshInterval = 10f; // Seconds between poll if WS not available

        private MapDataDto _lastData;

        private void Awake()
        {
            if (Instance == null) Instance = this;
            else Destroy(gameObject);
        }

        private void Start()
        {
            StartCoroutine(MapFetchLoop());
        }

        private IEnumerator MapFetchLoop()
        {
            while (true)
            {
                FetchMap();
                yield return new WaitForSeconds(refreshInterval);
            }
        }

        public void FetchMap()
        {
            StartCoroutine(GameSession.Instance.Get("/api/map", (json, err) => {
                if (err != null) { Debug.LogError($"Map Fetch Error: {err}"); return; }
                
                _lastData = JsonConvert.DeserializeObject<MapDataDto>(json);
                RenderCurrentData();
            }));
        }

        private void RenderCurrentData()
        {
            if (_lastData == null) return;

            // 1. Render static tiles
            // Note: In a real game, you'd want a chunking system for 300x200 (60,000 tiles).
            // For this prototype, we'll assume we're rendering a view-port or the full set if optimized.
            var shard = new ShardDto { Tiles = _lastData.tiles };
            mapRenderer.RenderMap(shard);

            // 2. Render active march arrows
            marchOverlay.RenderMarches(_lastData.marches);
        }

        public void OnTileClicked(int x, int y)
        {
            var tile = _lastData?.tiles.Find(t => t.X == x && t.Y == y);
            if (tile != null)
            {
                tileInspector.ShowTile(tile);
            }
        }
    }

    [Serializable]
    public class MapDataDto
    {
        public List<TileDto> tiles;
        public List<MarchDto> marches;
    }

    [Serializable]
    public class MarchDto
    {
        public string id;
        public string player_id;
        public string commander_id;
        public int from_x;
        public int from_y;
        public int to_x;
        public int to_y;
        public int troops;
        public string status;
        public long arrive_at;
    }
}
