using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;
using Newtonsoft.Json;

namespace Fangame.Networking
{
    /// <summary>
    /// Singleton that manages the authenticated player session.
    /// Holds the token, player profile, and exposes async API helpers.
    /// </summary>
    public class GameSession : MonoBehaviour
    {
        public static GameSession Instance { get; private set; }

        [Header("Server")]
        public string ServerUrl = "http://localhost:3847";

        // Session state
        public string PlayerId   { get; private set; }
        public string Token      { get; private set; }
        public string PlayerName { get; private set; }
        public int    Gems       { get; private set; }
        public bool   IsLoggedIn => !string.IsNullOrEmpty(Token);

        // Events
        public event Action<string>      OnLoginSuccess;
        public event Action<string>      OnLoginFailed;
        public event Action<ProfileDto>  OnProfileLoaded;
        public event Action<string>      OnApiError;

        private void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            // Try to restore session from PlayerPrefs
            Token      = PlayerPrefs.GetString("session_token",   "");
            PlayerId   = PlayerPrefs.GetString("session_player",  "");
            PlayerName = PlayerPrefs.GetString("session_display", "");
        }

        // ─────────────────────────────────────────────
        // AUTH
        // ─────────────────────────────────────────────

        public void Register(string username, string password, string displayName, string factionKey, Action<bool, string> callback)
        {
            var body = JsonConvert.SerializeObject(new { username, password, displayName, factionKey });
            StartCoroutine(Post("/api/auth/register", body, null, (json, err) =>
            {
                if (err != null) { callback(false, err); return; }
                var dto = JsonConvert.DeserializeObject<AuthResponseDto>(json);
                StoreSession(dto);
                callback(true, null);
            }));
        }

        public void Login(string username, string password, Action<bool, string> callback)
        {
            var body = JsonConvert.SerializeObject(new { username, password });
            StartCoroutine(Post("/api/auth/login", body, null, (json, err) =>
            {
                if (err != null) { callback(false, err); return; }
                var dto = JsonConvert.DeserializeObject<AuthResponseDto>(json);
                StoreSession(dto);
                OnLoginSuccess?.Invoke(dto.displayName);
                callback(true, null);
            }));
        }

        private void StoreSession(AuthResponseDto dto)
        {
            PlayerId   = dto.playerId;
            Token      = dto.token;
            PlayerName = dto.displayName;
            Gems       = dto.gems;
            PlayerPrefs.SetString("session_token",   Token);
            PlayerPrefs.SetString("session_player",  PlayerId);
            PlayerPrefs.SetString("session_display", PlayerName);
            PlayerPrefs.Save();
        }

        public void Logout()
        {
            Token = PlayerId = PlayerName = "";
            PlayerPrefs.DeleteKey("session_token");
            PlayerPrefs.DeleteKey("session_player");
            PlayerPrefs.DeleteKey("session_display");
        }

        // ─────────────────────────────────────────────
        // PROFILE
        // ─────────────────────────────────────────────

        public void FetchProfile(Action<ProfileDto> callback = null)
        {
            StartCoroutine(Get("/api/profile", (json, err) =>
            {
                if (err != null) { OnApiError?.Invoke(err); return; }
                var dto = JsonConvert.DeserializeObject<ProfileDto>(json);
                Gems = dto.gems;
                OnProfileLoaded?.Invoke(dto);
                callback?.Invoke(dto);
            }));
        }

        // ─────────────────────────────────────────────
        // GENERIC HTTP HELPERS
        // ─────────────────────────────────────────────

        public IEnumerator Get(string endpoint, Action<string, string> callback)
        {
            using var req = UnityWebRequest.Get(ServerUrl + endpoint);
            if (!string.IsNullOrEmpty(Token)) req.SetRequestHeader("X-Player-Token", Token);
            yield return req.SendWebRequest();
            if (req.result != UnityWebRequest.Result.Success) callback(null, req.error);
            else callback(req.downloadHandler.text, null);
        }

        public IEnumerator Post(string endpoint, string json, string token, Action<string, string> callback)
        {
            using var req = new UnityWebRequest(ServerUrl + endpoint, "POST");
            req.uploadHandler   = new UploadHandlerRaw(System.Text.Encoding.UTF8.GetBytes(json));
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            string t = token ?? Token;
            if (!string.IsNullOrEmpty(t)) req.SetRequestHeader("X-Player-Token", t);
            yield return req.SendWebRequest();
            if (req.result != UnityWebRequest.Result.Success) callback(null, req.error);
            else callback(req.downloadHandler.text, null);
        }

        // ─────────────────────────────────────────────
        // CONVENIENCE API CALLS
        // ─────────────────────────────────────────────

        public void FetchBuildings(Action<List<BuildingDto>> callback)
        {
            StartCoroutine(Get("/api/buildings", (json, err) =>
            {
                if (err != null) { OnApiError?.Invoke(err); return; }
                callback(JsonConvert.DeserializeObject<List<BuildingDto>>(json));
            }));
        }

        public void FetchTechTree(Action<string> callback)
        {
            StartCoroutine(Get("/api/tech/tree", (json, err) =>
            {
                if (err != null) { OnApiError?.Invoke(err); return; }
                callback(json);
            }));
        }

        public void FetchCommanders(Action<List<CommanderDto>> callback)
        {
            StartCoroutine(Get("/api/commanders", (json, err) =>
            {
                if (err != null) { OnApiError?.Invoke(err); return; }
                callback(JsonConvert.DeserializeObject<List<CommanderDto>>(json));
            }));
        }

        public void FetchLeaderboard(string type, Action<string> callback)
        {
            // type: "global" | "weekly" | "alliance"
            StartCoroutine(Get($"/api/leaderboard/{type}", (json, err) =>
            {
                if (err != null) { OnApiError?.Invoke(err); return; }
                callback(json);
            }));
        }

        public void GachaPull(Action<GachaPullResultDto> callback)
        {
            StartCoroutine(Post("/api/gacha/pull", "{}", null, (json, err) =>
            {
                if (err != null) { OnApiError?.Invoke(err); return; }
                callback(JsonConvert.DeserializeObject<GachaPullResultDto>(json));
            }));
        }

        public void UpgradeBuilding(string buildingKey, Action<string> callback)
        {
            var body = JsonConvert.SerializeObject(new { buildingKey });
            StartCoroutine(Post("/api/buildings/upgrade", body, null, (json, err) =>
            {
                if (err != null) { OnApiError?.Invoke(err); return; }
                callback(json);
            }));
        }

        public void StartResearch(string techKey, Action<string> callback)
        {
            var body = JsonConvert.SerializeObject(new { techKey });
            StartCoroutine(Post("/api/tech/research", body, null, (json, err) =>
            {
                if (err != null) { OnApiError?.Invoke(err); return; }
                callback(json);
            }));
        }

        public void FetchResources(Action<ResourcesDto> callback)
        {
            StartCoroutine(Get("/api/resources", (json, err) =>
            {
                if (err != null) { OnApiError?.Invoke(err); return; }
                callback(JsonConvert.DeserializeObject<ResourcesDto>(json));
            }));
        }
    }

    // ─────────────────────────────────────────────
    // DTOs
    // ─────────────────────────────────────────────

    [Serializable] public class AuthResponseDto
    {
        public string playerId;
        public string token;
        public string displayName;
        public int    gems;
    }

    [Serializable] public class ProfileDto
    {
        public string id;
        public string username;
        public string display_name;
        public int    gems;
        public long   created_at;
        public int    base_level;
        public string faction_id;
    }

    [Serializable] public class BuildingDto
    {
        public string key;
        public string name;
        public int    level;
        public int    maxLevel;
        public bool   isUpgrading;
        public long   finishAt;
        public int    secondsLeft;
    }

    [Serializable] public class CommanderDto
    {
        public string id;
        public string name;
        public string faction;
        public string archetype;
        public string rarity;
        public string description;
    }

    [Serializable] public class GachaPullResultDto
    {
        public string item;
        public int    pityCounter;
    }

    [Serializable] public class ResourcesDto
    {
        public ResourceBalanceDto balance;
        public ResourceProductionDto production;
    }

    [Serializable] public class ResourceBalanceDto
    {
        public int wood;
        public int ore;
        public int grain;
        public int stone;
    }

    [Serializable] public class ResourceProductionDto
    {
        public int grain_per_hour;
        public int ore_per_hour;
        public int wood_per_hour;
        public int total_power_production;
    }
}
