using UnityEngine;
using UnityEngine.UI;

namespace Fangame.UI
{
    /// <summary>
    /// Handles rendering a 3D prefab into a UI RenderTexture for Hi-Def Pull sequences.
    /// This removes the reliance on 2D images and instead spawns 3D rig animations directly on the UI card.
    /// </summary>
    public class Gacha3DModelViewer : MonoBehaviour
    {
        [Header("3D Setup")]
        public Camera renderCamera;
        public Transform modelSpawnPoint;
        public LayerMask renderingLayer; // e.g. "UI3D" so it doesn't render in main camera
        public RawImage uiOutputImage;

        private GameObject _currentCharacterModel;
        private RenderTexture _renderTexture;

        private void Awake()
        {
            // Setup an isolated render texture for crisp AAA presentation
            _renderTexture = new RenderTexture(1024, 1024, 24, RenderTextureFormat.ARGB32);
            _renderTexture.antiAliasing = 4;
            renderCamera.targetTexture = _renderTexture;
            uiOutputImage.texture = _renderTexture;
        }

        public void DisplayCharacter(GameObject characterPrefab)
        {
            if (_currentCharacterModel != null)
            {
                Destroy(_currentCharacterModel);
            }

            if (characterPrefab == null) return;

            _currentCharacterModel = Instantiate(characterPrefab, modelSpawnPoint);
            
            // Assign to secluded layer so it doesn't collide with overworld lighting
            SetLayerRecursively(_currentCharacterModel, Mathf.RoundToInt(Mathf.Log(renderingLayer.value, 2)));

            // Play summon animation if animator exists
            var animator = _currentCharacterModel.GetComponent<Animator>();
            if (animator != null)
            {
                animator.SetTrigger("Summoned");
            }

            // We can also trigger a particle effect here around the spawn point
        }

        private void SetLayerRecursively(GameObject obj, int newLayer)
        {
            obj.layer = newLayer;
            foreach (Transform child in obj.transform)
            {
                SetLayerRecursively(child.gameObject, newLayer);
            }
        }

        private void OnDestroy()
        {
            if (_renderTexture != null)
            {
                _renderTexture.Release();
                Destroy(_renderTexture);
            }
        }
    }
}
