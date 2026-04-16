using UnityEngine;

namespace Fangame.Map
{
    /// <summary>
    /// Smooth camera controller for the Hex World Map.
    /// Handles keyboard WASD movement and Mouse Scroll zoom.
    /// Bounds the camera to the 300x200 map dimensions.
    /// </summary>
    public class MapCameraController : MonoBehaviour
    {
        [Header("Movement")]
        public float moveSpeed = 50f;
        public float zoomSpeed = 20f;
        public Vector2 zoomLimits = new Vector2(10f, 100f);

        [Header("Map Bounds")]
        public Vector2 xBounds = new Vector2(-10f, 600f); // Adjust based on Hex spacing
        public Vector2 zBounds = new Vector2(-10f, 400f);

        private Camera _cam;

        private void Start()
        {
            _cam = GetComponent<Camera>();
        }

        private void Update()
        {
            HandleMovement();
            HandleZoom();
        }

        private void HandleMovement()
        {
            float horizontal = Input.GetAxis("Horizontal");
            float vertical   = Input.GetAxis("Vertical");

            Vector3 move = new Vector3(horizontal, 0f, vertical) * moveSpeed * Time.deltaTime;
            transform.position += move;

            // Clamp positions
            Vector3 pos = transform.position;
            pos.x = Mathf.Clamp(pos.x, xBounds.x, xBounds.y);
            pos.z = Mathf.Clamp(pos.z, zBounds.x, zBounds.y);
            transform.position = pos;
        }

        private void HandleZoom()
        {
            float scroll = Input.GetAxis("Mouse ScrollWheel");
            if (scroll != 0)
            {
                if (_cam.orthographic)
                {
                    _cam.orthographicSize = Mathf.Clamp(_cam.orthographicSize - scroll * zoomSpeed, zoomLimits.x, zoomLimits.y);
                }
                else
                {
                    transform.position += transform.forward * scroll * zoomSpeed;
                }
            }
        }

        public void FocusOn(int x, int y)
        {
            Vector3 worldPos = HexUtils.AxialToWorld(x, y);
            transform.position = new Vector3(worldPos.x, transform.position.y, worldPos.z);
        }
    }
}
