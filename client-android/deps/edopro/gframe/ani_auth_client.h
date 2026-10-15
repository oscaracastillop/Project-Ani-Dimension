#ifndef ANI_AUTH_CLIENT_H
#define ANI_AUTH_CLIENT_H

#include <string>
#include <vector>

namespace ygo {

struct CountryData {
	int id{ 0 };
	std::wstring name;
	std::string code;
	std::wstring flag;
};

struct LoginResult {
	bool success{ false };
	int code{ 0 }; // 1 = ok, 2 = sesion activa en otro dispositivo, 0 = invalido
	std::wstring message;
	int userId{ 0 };
	std::wstring username;
	std::wstring email;
	std::string sessionToken;
	std::wstring countryName;
	std::vector<std::wstring> roles;
	bool isAdmin{ false };
};

struct RegisterResult {
	bool success{ false };
	int code{ 0 };
	std::wstring message;
	int userId{ 0 };
};

struct ServerStatusResult {
	bool online{ false };
	int totalOnline{ 0 };
	int totalAccounts{ 0 };
	std::wstring serverName;
};

class AniAuthClient {
public:
	static ServerStatusResult CheckStatus();
	static std::vector<CountryData> GetCountries();
	static LoginResult Login(const std::wstring& username, const std::wstring& password, bool forceSession = false);
	static RegisterResult Register(const std::wstring& username, const std::wstring& email, const std::wstring& password, int countryId);
	static bool Logout(int userId, const std::string& token);
	static bool Heartbeat(int userId, const std::string& token);
};

} // namespace ygo

#endif // ANI_AUTH_CLIENT_H
