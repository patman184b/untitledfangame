using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using Newtonsoft.Json;
using Fangame.Networking;

namespace Fangame.UI
{
    /// <summary>
    /// Login / Register panel with faction selection on registration.
    /// 6 factions, max 250 players each.
    /// </summary>
    public class LoginPanel : MonoBehaviour
    {
        [Header("Panels")]
        public GameObject loginView;
        public GameObject registerView;
        public GameObject factionPickView;      // Step 2 of registration

        [Header("Login Fields")]
        public TMP_InputField  loginUsernameField;
        public TMP_InputField  loginPasswordField;
        public Button          loginButton;
        public Button          switchToRegisterButton;
        public TextMeshProUGUI loginErrorText;

        [Header("Register Fields")]
        public TMP_InputField  registerUsernameField;
        public TMP_InputField  registerPasswordField;
        public TMP_InputField  registerDisplayNameField;
        public Button          nextToFactionButton;       // Goes to faction picker
        public Button          switchToLoginButton;
        public TextMeshProUGUI registerErrorText;

        [Header("Faction Picker")]
        public Transform          factionButtonContainer;  // Grid of faction buttons
        public GameObject         factionButtonPrefab;     // Prefab with Name, Count, Select button
        public TextMeshProUGUI    factionErrorText;
        public Button             backToRegisterButton;

        [Header("Loading")]
        public GameObject loadingOverlay;

        private string             _selectedFaction;
        private List<FactionDto>   _factions;

        private void Start()
        {
            loginButton.onClick.AddListener(OnLoginClicked);
            nextToFactionButton.onClick.AddListener(OnNextToFactionClicked);
            backToRegisterButton.onClick.AddListener(() => SetView("register"));
            switchToRegisterButton.onClick.AddListener(() => SetView("register"));
            switchToLoginButton.onClick.AddListener(() => SetView("login"));

            SetView("login");
            ClearErrors();

            if (GameSession.Instance.IsLoggedIn)
            {
                gameObject.SetActive(false);
            }
        }

        private void SetView(string view)
        {
            loginView.SetActive(view == "login");
            registerView.SetActive(view == "register");
            factionPickView.SetActive(view == "faction");

            if (view == "faction") LoadFactions();
        }

        private void ClearErrors()
        {
            loginErrorText.text    = "";
            registerErrorText.text = "";
            factionErrorText.text  = "";
        }

        // ─────────────────────────────────────────────
        // LOGIN
        // ─────────────────────────────────────────────

        private void OnLoginClicked()
        {
            loginErrorText.text = "";
            string u = loginUsernameField.text.Trim();
            string p = loginPasswordField.text;

            if (string.IsNullOrEmpty(u) || string.IsNullOrEmpty(p))
            {
                loginErrorText.text = "Please enter username and password.";
                return;
            }

            SetLoading(true);
            GameSession.Instance.Login(u, p, (success, err) =>
            {
                SetLoading(false);
                if (success) gameObject.SetActive(false);
                else loginErrorText.text = err ?? "Login failed.";
            });
        }

        // ─────────────────────────────────────────────
        // REGISTER — Step 1 (credentials)
        // ─────────────────────────────────────────────

        private void OnNextToFactionClicked()
        {
            registerErrorText.text = "";
            string u = registerUsernameField.text.Trim();
            string p = registerPasswordField.text;

            if (string.IsNullOrEmpty(u) || u.Length < 3)
            {
                registerErrorText.text = "Username must be at least 3 characters.";
                return;
            }
            if (string.IsNullOrEmpty(p) || p.Length < 6)
            {
                registerErrorText.text = "Password must be at least 6 characters.";
                return;
            }

            SetView("faction");
        }

        // ─────────────────────────────────────────────
        // REGISTER — Step 2 (faction selection)
        // ─────────────────────────────────────────────

        private void LoadFactions()
        {
            SetLoading(true);
            StartCoroutine(GameSession.Instance.Get("/api/factions", (json, err) =>
            {
                SetLoading(false);
                if (err != null) { factionErrorText.text = "Failed to load factions."; return; }
                _factions = JsonConvert.DeserializeObject<List<FactionDto>>(json);
                BuildFactionButtons();
            }));
        }

        private void BuildFactionButtons()
        {
            foreach (Transform c in factionButtonContainer) Destroy(c.gameObject);

            foreach (var f in _factions)
            {
                var btn = Instantiate(factionButtonPrefab, factionButtonContainer);
                var txts = btn.GetComponentsInChildren<TextMeshProUGUI>();
                if (txts.Length >= 2)
                {
                    txts[0].text = f.name;
                    txts[1].text = f.isFull
                        ? "FULL"
                        : $"{f.playerCount} / {f.maxPlayers}";
                }

                // Color
                if (ColorUtility.TryParseHtmlString(f.color, out Color col))
                {
                    var img = btn.GetComponent<Image>();
                    if (img != null) img.color = col with { a = 0.3f };
                }

                // Disable full factions
                var selectBtn = btn.GetComponent<Button>();
                if (selectBtn != null)
                {
                    selectBtn.interactable = !f.isFull;
                    var capturedFaction = f.key;
                    selectBtn.onClick.AddListener(() => OnFactionSelected(capturedFaction, btn));
                }
            }
        }

        private void OnFactionSelected(string factionKey, GameObject selectedBtn)
        {
            _selectedFaction = factionKey;
            factionErrorText.text = "";

            // Visual feedback — highlight selected
            foreach (Transform c in factionButtonContainer)
            {
                var img = c.GetComponent<Image>();
                if (img != null) img.color = img.color with { a = c.gameObject == selectedBtn ? 0.7f : 0.2f };
            }

            // Auto-Submit after brief delay
            StartCoroutine(SubmitRegistrationAfterDelay());
        }

        private IEnumerator SubmitRegistrationAfterDelay()
        {
            yield return new WaitForSeconds(0.3f);
            SubmitRegistration();
        }

        private void SubmitRegistration()
        {
            string u = registerUsernameField.text.Trim();
            string p = registerPasswordField.text;
            string d = registerDisplayNameField.text.Trim();

            SetLoading(true);
            GameSession.Instance.Register(u, p, string.IsNullOrEmpty(d) ? u : d, _selectedFaction, (success, err) =>
            {
                SetLoading(false);
                if (success) gameObject.SetActive(false);
                else { SetView("faction"); factionErrorText.text = err ?? "Registration failed."; }
            });
        }

        // ─────────────────────────────────────────────
        // HELPERS
        // ─────────────────────────────────────────────

        private void SetLoading(bool show)
        {
            if (loadingOverlay != null) loadingOverlay.SetActive(show);
            loginButton.interactable         = !show;
            nextToFactionButton.interactable = !show;
        }
    }

    [Serializable]
    public class FactionDto
    {
        public string key;
        public string name;
        public string color;
        public string description;
        public int    playerCount;
        public int    maxPlayers;
        public bool   isFull;
    }
}

