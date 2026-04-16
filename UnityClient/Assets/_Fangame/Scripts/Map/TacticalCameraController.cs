using UnityEngine;

namespace Fangame.Map
{
    public class TacticalCameraController : MonoBehaviour
    {
        [Header("Movement Settings")]
        public float moveSpeed = 50f;
        public float zoomSpeed = 500f;
        public Vector2 zoomBounds = new Vector2(20f, 200f);
        public Vector2 mapBounds = new Vector2(1000f, 600f);

        [Header("Rotation Settings")]
        public float tiltAngle = 45f;
        public float rotationSpeed = 100f;

        private Camera cam;
        private float currentZoom = 100f;

        void Start()
        {
            cam = GetComponent<Camera>();
            transform.rotation = Quaternion.Euler(tiltAngle, 0, 0);
        }

        void Update()
        {
            HandleMovement();
            HandleZoom();
        }

        private void HandleMovement()
        {
            float horizontal = Input.GetAxis("Horizontal");
            float vertical = Input.GetAxis("Vertical");

            Vector3 translation = new Vector3(horizontal, 0, vertical) * moveSpeed * Time.deltaTime;
            transform.Translate(translation, Space.World);

            // Clamp to map bounds
            Vector3 pos = transform.position;
            pos.x = Mathf.Clamp(pos.x, 0, mapBounds.x);
            pos.z = Mathf.Clamp(pos.z, 0, mapBounds.y);
            transform.position = pos;
        }

        private void HandleZoom()
        {
            float scroll = Input.GetAxis("Mouse ScrollWheel");
            currentZoom = Mathf.Clamp(currentZoom - scroll * zoomSpeed * Time.deltaTime, zoomBounds.x, zoomBounds.y);
            
            // Adjust camera height for zoom
            Vector3 pos = transform.position;
            pos.y = currentZoom;
            transform.position = pos;

            // Optional: Adjust tilt based on zoom level
            float zoomPercent = (currentZoom - zoomBounds.x) / (zoomBounds.y - zoomBounds.x);
            transform.rotation = Quaternion.Euler(Mathf.Lerp(60f, 30f, zoomPercent), 0, 0);
        }
    }
}
