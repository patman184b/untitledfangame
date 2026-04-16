using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections.Generic;

namespace Fangame.UI
{
    public class SkillTreeManager : MonoBehaviour
    {
        [Header("References")]
        public TextMeshProUGUI availablePointsText;
        public Button resetSkillPointsButton;
        
        [Header("Tiers")]
        public GameObject tier1Node;
        public GameObject tier2Node;
        public GameObject tier3Node;

        private CommanderData currentCommander;

        public void Open(CommanderData data)
        {
            currentCommander = data;
            gameObject.SetActive(true);
            RefreshUI();
        }

        public void RefreshUI()
        {
            availablePointsText.text = $"Skill Points: {currentCommander.availableSkillPoints}";
            
            // Tier Unlocks based on Respect
            SetNodeInteractivity(tier2Node, currentCommander.respectLevel >= 3);
            SetNodeInteractivity(tier3Node, currentCommander.respectLevel >= 5);
        }

        public void ResetSkills()
        {
            // FREE Reset logic
            Debug.Log("Resetting skills for free...");
            currentCommander.availableSkillPoints = currentCommander.level + currentCommander.respectLevel;
            RefreshUI();
        }

        private void SetNodeInteractivity(GameObject node, bool unlocked)
        {
            var canvasGroup = node.GetComponent<CanvasGroup>();
            if (canvasGroup != null)
            {
                canvasGroup.alpha = unlocked ? 1.0f : 0.5f;
                canvasGroup.interactable = unlocked;
            }
        }
    }
}
