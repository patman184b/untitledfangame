using System.Collections.Generic;
using UnityEngine;

namespace Fangame.Map
{
    public class UnitVisibilityManager : MonoBehaviour
    {
        public static UnitVisibilityManager Instance;

        private Dictionary<Vector2Int, List<GameObject>> _unitPlacements = new Dictionary<Vector2Int, List<GameObject>>();
        private HashSet<Vector2Int> _occupiedHexes = new HashSet<Vector2Int>();

        private void Awake()
        {
            Instance = this;
        }

        public void RegisterUnit(GameObject unit, int q, int r)
        {
            Vector2Int pos = new Vector2Int(q, r);
            if (!_unitPlacements.ContainsKey(pos)) _unitPlacements[pos] = new List<GameObject>();
            _unitPlacements[pos].Add(unit);
            
            // Initial visibility check
            UpdateUnitVisibility(unit, pos);
        }

        public void SetVisibleHexes(HashSet<Vector2Int> occupied)
        {
            _occupiedHexes = occupied;
            RefreshAllVisibility();
        }

        private void RefreshAllVisibility()
        {
            foreach (var kvp in _unitPlacements)
            {
                bool isVisible = _occupiedHexes.Contains(kvp.Key);
                foreach (var unit in kvp.Value)
                {
                    if (unit != null) unit.SetActive(isVisible);
                }
            }
        }

        private void UpdateUnitVisibility(GameObject unit, Vector2Int pos)
        {
            unit.SetActive(_occupiedHexes.Contains(pos));
        }
    }
}
