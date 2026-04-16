using System.Collections.Generic;
using UnityEngine;
using TMPro;
using Fangame.Networking;

namespace Fangame.Map
{
    public class HexMapRenderer : MonoBehaviour
    {
        [Header("Prefabs")]
        public GameObject grassPrefab;
        public GameObject waterPrefab;
        public GameObject mountainPrefab;
        public GameObject hillPrefab;

        [Header("Overlays")]
        public GameObject productionLabelPrefab; // World-space TextMeshPro label (+X/h)
        public GameObject burningCityVfxPrefab;  // Fire particle system for low siege HP
        public float burningThreshold = 0.25f;   // Trigger VFX below 25% siege HP

        [Header("Alliance Tinting")]
        public Color gondorColor   = new Color(0.2f, 0.2f, 0.8f, 0.3f);
        public Color mordorColor   = new Color(0.8f, 0.2f, 0.2f, 0.3f);
        public Color rohanColor    = new Color(0.2f, 0.8f, 0.2f, 0.3f);
        public Color isengardColor = new Color(1f,   1f,   0f,   0.3f);
        public Color elvesColor    = new Color(0.2f, 1f,   1f,   0.3f);
        public Color neutralColor  = new Color(1f,   1f,   1f,   0.1f);

        private Dictionary<Vector2Int, GameObject> _spawnedTiles  = new Dictionary<Vector2Int, GameObject>();
        private Dictionary<Vector2Int, GameObject> _overlayLabels = new Dictionary<Vector2Int, GameObject>();
        private Dictionary<Vector2Int, GameObject> _burningVfx    = new Dictionary<Vector2Int, GameObject>();
        private Dictionary<string, Color> _allianceColors;

        private void Awake()
        {
            _allianceColors = new Dictionary<string, Color>
            {
                { "Gondor",   gondorColor   },
                { "Mordor",   mordorColor   },
                { "Rohan",    rohanColor    },
                { "Isengard", isengardColor },
                { "Elves",    elvesColor    },
                { "Neutral",  neutralColor  }
            };
        }

        // ─────────────────────────────────────────────
        // MAIN RENDER ENTRY
        // ─────────────────────────────────────────────

        public void RenderMap(ShardDto shard)
        {
            ClearMap();
            foreach (var tile in shard.Tiles)
            {
                SpawnTile(tile);
            }
        }

        // ─────────────────────────────────────────────
        // TILE SPAWNING
        // ─────────────────────────────────────────────

        private void SpawnTile(TileDto tile)
        {
            var coord = new Vector2Int(tile.X, tile.Y);

            // 1. Structural Suppression — only anchor tile renders the full model
            if (!string.IsNullOrEmpty(tile.StructureId) && !tile.IsAnchor)
            {
                SpawnGroundOnly(tile);
                return;
            }

            GameObject prefab = GetPrefabForTerrain(tile.Terrain);
            Vector3 worldPos  = HexUtils.AxialToWorld(tile.X, tile.Y);
            GameObject hex    = Instantiate(prefab, worldPos, Quaternion.identity, transform);
            hex.name          = $"Hex_{tile.X}_{tile.Y}";
            _spawnedTiles[coord] = hex;

            // 2. Alliance territory tint
            ApplyInfluenceTint(hex, tile.AllianceId);

            // 3. Resource production overlay (+X/h label)
            if (tile.ProductionPerHour > 0)
            {
                SpawnProductionLabel(coord, worldPos, tile.ProductionPerHour);
            }

            // 4. Burning VFX for structures with low siege HP
            if (tile.IsAnchor && tile.MaxSiegeHp > 0)
            {
                float hpRatio = (float)tile.SiegeHp / tile.MaxSiegeHp;
                if (hpRatio <= burningThreshold && burningCityVfxPrefab != null)
                {
                    var vfx = Instantiate(burningCityVfxPrefab, worldPos + Vector3.up * 2f, Quaternion.identity, transform);
                    _burningVfx[coord] = vfx;
                }
            }
        }

        // ─────────────────────────────────────────────
        // PRODUCTION OVERLAY (+X/h)
        // ─────────────────────────────────────────────

        private void SpawnProductionLabel(Vector2Int coord, Vector3 worldPos, int productionPerHour)
        {
            if (productionLabelPrefab == null) return;

            // Offset upward so it floats above the tile
            Vector3 labelPos = worldPos + new Vector3(0f, 1.5f, 0f);
            GameObject label = Instantiate(productionLabelPrefab, labelPos, Quaternion.identity, transform);

            var tmp = label.GetComponentInChildren<TextMeshPro>();
            if (tmp != null)
            {
                tmp.text = $"+{productionPerHour}/h";
                tmp.color = new Color(0.9f, 0.85f, 0.3f); // Gold text
                tmp.fontSize = 2.5f;
            }

            _overlayLabels[coord] = label;
        }

        // ─────────────────────────────────────────────
        // ALLIANCE TINTING
        // ─────────────────────────────────────────────

        private void ApplyInfluenceTint(GameObject hex, string allianceId)
        {
            var renderer = hex.GetComponentInChildren<MeshRenderer>();
            if (renderer == null) return;

            string key = string.IsNullOrEmpty(allianceId) ? "Neutral" : allianceId;
            Color col = _allianceColors.TryGetValue(key, out var c) ? c : neutralColor;

            var prop = new MaterialPropertyBlock();
            prop.SetColor("_BaseColor", col);
            renderer.SetPropertyBlock(prop);
        }

        // ─────────────────────────────────────────────
        // FOG OF WAR
        // ─────────────────────────────────────────────

        public void ApplyFogState(Vector2Int coord, string fogStatus)
        {
            if (!_spawnedTiles.TryGetValue(coord, out GameObject go)) return;
            var renderer = go.GetComponentInChildren<MeshRenderer>();
            if (renderer == null) return;

            switch (fogStatus)
            {
                case "occupied":
                    renderer.material.color = Color.white;
                    break;
                case "explored":
                    renderer.material.color = new Color(0.5f, 0.5f, 0.5f, 1f);
                    break;
                case "unexplored":
                    renderer.material.color = new Color(0.15f, 0.15f, 0.15f, 1f);
                    // Hide production labels in fog
                    if (_overlayLabels.TryGetValue(coord, out var lbl)) lbl.SetActive(false);
                    if (_burningVfx.TryGetValue(coord, out var vfx))    vfx.SetActive(false);
                    break;
            }
        }

        // ─────────────────────────────────────────────
        // HELPERS
        // ─────────────────────────────────────────────

        private void SpawnGroundOnly(TileDto tile)
        {
            Vector3 pos = HexUtils.AxialToWorld(tile.X, tile.Y);
            Instantiate(grassPrefab, pos, Quaternion.identity, transform);
        }

        private void ClearMap()
        {
            foreach (var go in _spawnedTiles.Values)    Destroy(go);
            foreach (var go in _overlayLabels.Values)   Destroy(go);
            foreach (var go in _burningVfx.Values)      Destroy(go);
            _spawnedTiles.Clear();
            _overlayLabels.Clear();
            _burningVfx.Clear();
        }

        private GameObject GetPrefabForTerrain(string terrain)
        {
            return terrain switch
            {
                "Gg" => grassPrefab,
                "Ww" => waterPrefab,
                "Mm" => mountainPrefab,
                "Hh" => hillPrefab,
                _    => grassPrefab
            };
        }
    }
}

