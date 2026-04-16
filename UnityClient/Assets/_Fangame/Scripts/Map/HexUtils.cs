using UnityEngine;

namespace Fangame.Map
{
    public static class HexUtils
    {
        public const float OuterRadius = 10f;
        public const float InnerRadius = OuterRadius * 0.866025404f;

        public static Vector3 AxialToWorld(int q, int r)
        {
            float x = (q + r * 0.5f) * (InnerRadius * 2f);
            float z = r * (OuterRadius * 1.5f);
            return new Vector3(x, 0, z);
        }

        public static (int q, int r) WorldToAxial(Vector3 position)
        {
            float q = (position.x * Mathf.Sqrt(3f) / 3f - position.z / 3f) / OuterRadius;
            float r = position.z * 2f / 3f / OuterRadius;
            return RoundToAxial(q, r);
        }

        private static (int q, int r) RoundToAxial(float q, float r)
        {
            float s = -q - r;
            int iQ = Mathf.RoundToInt(q);
            int iR = Mathf.RoundToInt(r);
            int iS = Mathf.RoundToInt(s);

            float dQ = Mathf.Abs(iQ - q);
            float dR = Mathf.Abs(iR - r);
            float dS = Mathf.Abs(iS - s);

            if (dQ > dR && dQ > dS)
            {
                iQ = -iR - iS;
            }
            else if (dR > dS)
            {
                iR = -iQ - iS;
            }
            return (iQ, iR);
        }
    }
}
