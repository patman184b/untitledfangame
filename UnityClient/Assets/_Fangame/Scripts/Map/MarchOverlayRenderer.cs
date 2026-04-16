using System.Collections.Generic;
using UnityEngine;

namespace Fangame.Map
{
    /// <summary>
    /// Renders arrows for active marches on the map using LineRenderers.
    /// Tinted by faction/player relationship (Friendly = blue/green, Enemy = red).
    /// </summary>
    public class MarchOverlayRenderer : MonoBehaviour
    {
        public GameObject arrowPrefab; // Prefab with a LineRenderer and an Arrow mesh at the end
        private List<GameObject> _activeArrows = new List<GameObject>();

        public void RenderMarches(List<MarchDto> marches)
        {
            ClearMarches();
            if (marches == null) return;

            foreach (var march in marches)
            {
                SpawnMarchArrow(march);
            }
        }

        private void SpawnMarchArrow(MarchDto march)
        {
            Vector3 startPos = HexUtils.AxialToWorld(march.from_x, march.from_y) + Vector3.up * 0.5f;
            Vector3 endPos   = HexUtils.AxialToWorld(march.to_x, march.to_y) + Vector3.up * 0.5f;

            GameObject arrow = Instantiate(arrowPrefab, transform);
            var lr = arrow.GetComponent<LineRenderer>();
            if (lr != null)
            {
                lr.SetPosition(0, startPos);
                lr.SetPosition(1, endPos);

                // Set color based on player ID
                bool isOwn = march.player_id == Networking.GameSession.Instance.PlayerId;
                lr.startColor = lr.endColor = isOwn ? Color.green : Color.red;
            }

            // Optional: Add a small unit sprite/model moving along the line
            // ...

            _activeArrows.Add(arrow);
        }

        private void ClearMarches()
        {
            foreach (var a in _activeArrows) Destroy(a);
            _activeArrows.Clear();
        }
    }
}
