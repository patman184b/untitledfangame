#if UNITY_EDITOR
using UnityEngine;
using UnityEditor;
using System.IO;

namespace Fangame.Editor
{
    /// <summary>
    /// Procedurally generates 3D Mesh assets for the Hex Base, Mountains, and Forests,
    /// so you have actual 3D models to use in the HexMap3DRenderer without needing external software.
    /// </summary>
    public class HexAssetGenerator : EditorWindow
    {
        [MenuItem("Tools/Fangame/Generate 3D Map Assets")]
        public static void GenerateHexAssets()
        {
            string folderPath = "Assets/_Fangame/Models";
            if (!AssetDatabase.IsValidFolder("Assets/_Fangame"))
                AssetDatabase.CreateFolder("Assets", "_Fangame");
            if (!AssetDatabase.IsValidFolder(folderPath))
                AssetDatabase.CreateFolder("Assets/_Fangame", "Models");

            // 1. Generate Base Plains Hex
            Mesh plainsMesh = GenerateHexCylinder(1f, 0.2f, flatTop: true);
            SaveMesh(plainsMesh, $"{folderPath}/HexPlains.asset");

            // 2. Generate Mountain Hex (taller, jagged center)
            Mesh mountainMesh = GenerateHexMountain(1f, 1.2f);
            SaveMesh(mountainMesh, $"{folderPath}/HexMountain.asset");

            // 3. Generate Water Hex (slightly recessed for shaders)
            Mesh waterMesh = GenerateHexCylinder(1f, 0.15f, flatTop: true);
            SaveMesh(waterMesh, $"{folderPath}/HexWater.asset");

            AssetDatabase.Refresh();
            Debug.Log("Generated 3D Hex Models in " + folderPath);
        }

        private static void SaveMesh(Mesh mesh, string path)
        {
            Mesh existing = AssetDatabase.LoadAssetAtPath<Mesh>(path);
            if (existing != null)
            {
                existing.Clear();
                EditorUtility.CopySerialized(mesh, existing);
            }
            else
            {
                AssetDatabase.CreateAsset(mesh, path);
            }
        }

        private static Mesh GenerateHexCylinder(float radius, float height, bool flatTop)
        {
            Mesh mesh = new Mesh();
            mesh.name = "ProceduralHex";

            Vector3[] vertices = new Vector3[14];
            int[] triangles = new int[36];
            Vector2[] uvs = new Vector2[14];

            // Top Center
            vertices[0] = new Vector3(0, height, 0);
            uvs[0] = new Vector2(0.5f, 0.5f);
            
            // Bottom Center
            vertices[1] = new Vector3(0, 0, 0);
            uvs[1] = new Vector2(0.5f, 0.5f);

            // 6 Outer Verts Top and Bottom
            for (int i = 0; i < 6; i++)
            {
                float angle = Mathf.Deg2Rad * (30f + 60f * i); // Flat topped hex orientation
                float x = Mathf.Cos(angle) * radius;
                float z = Mathf.Sin(angle) * radius;

                // Top Vertices (2 to 7)
                vertices[i + 2] = new Vector3(x, height, z);
                uvs[i + 2] = new Vector2((x / radius + 1) * 0.5f, (z / radius + 1) * 0.5f);

                // Bottom Vertices (8 to 13)
                vertices[i + 8] = new Vector3(x, 0, z);
                uvs[i + 8] = new Vector2((x / radius + 1) * 0.5f, (z / radius + 1) * 0.5f);
            }

            int triIndex = 0;

            for (int i = 0; i < 6; i++)
            {
                int currentTop = 2 + i;
                int nextTop = 2 + ((i + 1) % 6);
                int currentBot = 8 + i;
                int nextBot = 8 + ((i + 1) % 6);

                // Top flat
                triangles[triIndex++] = 0;
                triangles[triIndex++] = nextTop;
                triangles[triIndex++] = currentTop;

                // Bottom flat
                triangles[triIndex++] = 1;
                triangles[triIndex++] = currentBot;
                triangles[triIndex++] = nextBot;

                // Sides (Quad = 2 Triangles)
                triangles[triIndex++] = currentTop;
                triangles[triIndex++] = nextTop;
                triangles[triIndex++] = currentBot;

                triangles[triIndex++] = nextTop;
                triangles[triIndex++] = nextBot;
                triangles[triIndex++] = currentBot;
            }

            mesh.vertices = vertices;
            mesh.triangles = triangles;
            mesh.uv = uvs;
            mesh.RecalculateNormals();

            return mesh;
        }

        private static Mesh GenerateHexMountain(float radius, float height)
        {
            Mesh mesh = GenerateHexCylinder(radius, 0.2f, false);
            mesh.name = "ProceduralMountain";
            Vector3[] verts = mesh.vertices;
            // Pull the top center vertex up
            verts[0] = new Vector3(0, height, 0);
            
            // Optionally jitter the outer top ring for a jagged mountain
            for (int i = 2; i < 8; i++)
            {
                verts[i].y += Random.Range(0.1f, 0.4f);
            }

            mesh.vertices = verts;
            mesh.RecalculateNormals();
            return mesh;
        }
    }
}
#endif
