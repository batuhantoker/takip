import { describe, expect, it } from 'vitest';
import { parsePgpKey } from './pgp';

// security@python.org's key as keys.openpgp.org serves it; the armor comment carries the fingerprint to check against.
const PYTHON_SECURITY = `-----BEGIN PGP PUBLIC KEY BLOCK-----
Comment: F314 452F E3F9 BF87 0435  7732 D273 E0FF D067 453C

xsBNBEyH8KIBCADLe9mczGnhhLFBbxWDgxHzzr/eExGuVQb+VYsa0WDZG4z/y+Kx
KsZ8da/adKaiig2soQJiZtYb6w1JDtugwy8+ySDY8ECAB7qdGK6gB17P1UFsI93d
IAe25DdEybbi0sMPbw0Q5Ka+ihI1ZnPifyG0oLK901QfTutOYAk42J7V/p6fHzK+
pCeOri+aSGlWxVtC03iPNIiL5InfKPCEvZ5ih8/98hCqccp6teDaGxhnab+5GYZq
wDknmK230r5UWd/VlGSiC4DJCuE+GY1r1DXx+E/ANjeMZOXQ4kBMxp8aFz7k1vFX
Mbqv+TWD+BZzgu6Fa4KCgWW7Jn1syKpwA7ahABEBAAHNM1B5dGhvbiBTZWN1cml0
eSBSZXNwb25zZSBUZWFtIDxzZWN1cml0eUBweXRob24ub3JnPsLAjwQTAQIAIgUC
TIfwogIbAwYLCQgHAwIGFQgCCQoLBBYCAwECHgECF4AAIQkQ0nPg/9BnRTwWIQTz
FEUv4/m/hwQ1dzLSc+D/0GdFPBGjB/4g3SsbkaP+q6F+FLQLKqhhi7cf0jxYNLD0
jsaNVBjQpkBtgSY1tn8qbBrn2ileggYp+jYoQNXAAN/Xu+l0gRH1tykUXR88WcAY
jVdZAqRlfy5yQHhOQRC/FmkuMPXhdfx4UxfAsFzcgYxhElQiAQLkLb9ORoJzmqBP
DQ/y0J3sk2B7L46B/UoTSSzfgwqxcPjFXhZLYp+7YeOgBRGGpAevdSDmQUogcB4p
jsQBVS8anqvi4wKwBYopRZRl9hKkfv5QBY63ERsOkO3kiuY4jZXrRfeoZo0zEX7B
Bz8ykz4vUE3ht1/p2UHe7qAeSLF2gyViHr9Ps1kxnccpXdELmF/ozsBNBEyH8KIB
CACxYoQQlOcP6l/TNlzVu3R8c0sSTfob5ocwrvsvOE+l4A4Kbfb3q+OOgrL304Aq
7IoxUVjn2crNneVe8/z3K7GAnBYkzu5/SJnSeOjUM/HJnWOV0+JkSJeFKHAM0BBH
cSQ/wi+KWxXcEpxY78TrAKIwtAWlYOU91PDu/cvAacM2ToCZTomLLS1uto3KrtRI
i77zTJRwn8odhc+DHRkRkhaFAqid6Q34CGklpI5Q9V5h3EzCPdlIc5N/M5FdWeNu
xw+d9K3PkXp9WeKQOdJliA5q5okITCpUSl3Ez07vC5Gxl/hQY3XfAwxtGcQOea3Z
UGw0rY02q9BRyKYxxs73LZXnABEBAAHCwHYEGAECAAkFAkyH8KICGwwAIQkQ0nPg
/9BnRTwWIQTzFEUv4/m/hwQ1dzLSc+D/0GdFPCmjCACLpG6UBXKFVcwPw20IZAmJ
AnWGFl2nAu9caKuOZpzP4EgzBgWorWSF/54Lwyx+yO7X/nznCKNMPpjwbhkGXxh8
mGdkL9Qx4HWCQuFPHHH7Z87+hsWMYsAenpVRYDq0vPAeWPRnVA84zvGRd883atB8
uADf3J/sm5A1g8cC53HTPRV9/XB5xBJmRPrvammnCq/7oVb3qmzTh/TeosK6dDnN
A+iravblPrBgvulwUYWZVE9MhMcsRBtWm6SCAtSm8rULzvhI7Men1eee/OKsqag8
qe3bTx1glw+5sCN853mGW51dJ2b85wYTROA6h7qryPAuyk+w46mi9xVR3TLcq3D5
=ZlpQ
-----END PGP PUBLIC KEY BLOCK-----`;

describe('parsePgpKey', () => {
  it('reads the fingerprint, date and verified user IDs', () => {
    const key = parsePgpKey(PYTHON_SECURITY);
    expect(key?.fingerprint).toBe('F314452FE3F9BF8704357732D273E0FFD067453C');
    expect(key?.created).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(key?.uids.some(u => u.includes('security@python.org'))).toBe(true);
  });

  it('refuses anything that isn’t an armored key', () => {
    expect(parsePgpKey('not a key')).toBeNull();
  });
});
