using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System;

namespace Fangame.UI
{
    public class SkillRowItem : MonoBehaviour
    {
        public TextMeshProUGUI skillNameText;
        public TextMeshProUGUI levelText;
        public TextMeshProUGUI effectText;
        public Button upgradeButton;

        public void Setup(SkillDefDto def, int level, Action onUpgrade)
        {
            skillNameText.text = def.name;
            levelText.text = $"Lvl: {level}";
            effectText.text = def.effect;
            
            upgradeButton.onClick.RemoveAllListeners();
            upgradeButton.onClick.AddListener(() => onUpgrade());
        }
    }
}
