#include "ani_auth_client.h"
#include "curl.h"
#include "game_config.h"
#include <nlohmann/json.hpp>
#include <iostream>
#include <sstream>

#ifdef _WIN32
#include <windows.h>
#endif

namespace ygo {

static std::string WStringToUTF8(const std::wstring& wstr) {
#ifdef _WIN32
	if (wstr.empty()) return "";
	int size_needed = WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), (int)wstr.size(), NULL, 0, NULL, NULL);
	std::string strTo(size_needed, 0);
	WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), (int)wstr.size(), &strTo[0], size_needed, NULL, NULL);
	return strTo;
#else
	return std::string(wstr.begin(), wstr.end());
#endif
}

static std::string GetBaseAuthUrl() {
#ifdef _ANDROID
	if (gGameConfig && !gGameConfig->lasthost.empty()) {
		std::string host = WStringToUTF8(gGameConfig->lasthost);
		if (host != "127.0.0.1" && host != "localhost") {
			return "http://" + host + ":7920";
		}
	}
	return "http://172.28.38.45:7920";
#else
	return "http://127.0.0.1:7920";
#endif
}

#define BASE_AUTH_URL GetBaseAuthUrl()


static std::wstring UTF8ToWString(const std::string& str) {
#ifdef _WIN32
	if (str.empty()) return L"";
	int size_needed = MultiByteToWideChar(CP_UTF8, 0, str.c_str(), (int)str.size(), NULL, 0);
	std::wstring wstrTo(size_needed, 0);
	MultiByteToWideChar(CP_UTF8, 0, str.c_str(), (int)str.size(), &wstrTo[0], size_needed);
	return wstrTo;
#else
	return std::wstring(str.begin(), str.end());
#endif
}

static size_t CurlWriteCallback(void* contents, size_t size, size_t nmemb, void* userp) {
	size_t realsize = size * nmemb;
	std::string* str = static_cast<std::string*>(userp);
	str->append(static_cast<char*>(contents), realsize);
	return realsize;
}

static std::string HttpGet(const std::string& url, long timeoutSec = 5) {
	std::string response;
	auto curl = curl_easy_init();
	if (!curl) return "";

	curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
	curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, CurlWriteCallback);
	curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
	curl_easy_setopt(curl, CURLOPT_TIMEOUT, timeoutSec);
	curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, timeoutSec);
	curl_easy_setopt(curl, CURLOPT_NOPROXY, "*");

	CURLcode res = curl_easy_perform(curl);
	curl_easy_cleanup(curl);

	if (res != CURLE_OK) {
		return "";
	}
	return response;
}

static std::string HttpPost(const std::string& url, const std::string& jsonBody, long timeoutSec = 7) {
	std::string response;
	auto curl = curl_easy_init();
	if (!curl) return "";

	struct curl_slist* headers = NULL;
	headers = curl_slist_append(headers, "Content-Type: application/json");

	curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
	curl_easy_setopt(curl, CURLOPT_POST, 1L);
	curl_easy_setopt(curl, CURLOPT_POSTFIELDS, jsonBody.c_str());
	curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
	curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, CurlWriteCallback);
	curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
	curl_easy_setopt(curl, CURLOPT_TIMEOUT, timeoutSec);
	curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, timeoutSec);
	curl_easy_setopt(curl, CURLOPT_NOPROXY, "*");

	CURLcode res = curl_easy_perform(curl);
	curl_slist_free_all(headers);
	curl_easy_cleanup(curl);

	if (res != CURLE_OK) {
		return "";
	}
	return response;
}

ServerStatusResult AniAuthClient::CheckStatus() {
	ServerStatusResult result;
	std::string resp = HttpGet(BASE_AUTH_URL + "/api/status", 3);
	if (resp.empty()) {
		result.online = false;
		return result;
	}

	try {
		auto j = nlohmann::json::parse(resp);
		result.online = j.value("online", false);
		result.totalOnline = j.value("totalOnline", 0);
		result.totalAccounts = j.value("totalAccounts", 0);
		if (j.contains("server")) {
			result.serverName = UTF8ToWString(j["server"].get<std::string>());
		}
	} catch (...) {
		result.online = false;
	}
	return result;
}

std::vector<CountryData> AniAuthClient::GetCountries() {
	std::vector<CountryData> list;
	std::string resp = HttpGet(BASE_AUTH_URL + "/api/countries", 5);
	if (resp.empty()) return list;

	try {
		auto j = nlohmann::json::parse(resp);
		if (j.contains("countries") && j["countries"].is_array()) {
			for (const auto& item : j["countries"]) {
				CountryData c;
				c.id = item.value("IdPais", 0);
				c.code = item.value("CodigoISO", "");
				c.name = UTF8ToWString(item.value("Nombre", ""));
				if (item.contains("IconoBandera") && !item["IconoBandera"].is_null()) {
					c.flag = UTF8ToWString(item["IconoBandera"].get<std::string>());
				}
				list.push_back(c);
			}
		}
	} catch (...) {
	}
	return list;
}

LoginResult AniAuthClient::Login(const std::wstring& username, const std::wstring& password, bool forceSession) {
	LoginResult res;
	nlohmann::json req;
	req["username"] = WStringToUTF8(username);
	req["password"] = WStringToUTF8(password);
	req["forceSession"] = forceSession;

	std::string resp = HttpPost(BASE_AUTH_URL + "/api/login", req.dump());
	if (resp.empty()) {
		res.success = false;
		res.code = 0;
		res.message = L"No se pudo conectar con el servidor.";
		return res;
	}

	try {
		auto j = nlohmann::json::parse(resp);
		res.code = j.value("code", 0);
		res.success = (res.code == 1);
		res.message = UTF8ToWString(j.value("message", ""));

		if (res.code == 1 && j.contains("user")) {
			const auto& u = j["user"];
			res.userId = u.value("id", 0);
			res.username = UTF8ToWString(u.value("username", ""));
			res.email = UTF8ToWString(u.value("email", ""));
			res.sessionToken = u.value("sessionToken", "");
			res.countryName = UTF8ToWString(u.value("countryName", ""));
			res.isAdmin = u.value("isAdmin", false);
			if (u.contains("roles") && u["roles"].is_array()) {
				for (const auto& r : u["roles"]) {
					res.roles.push_back(UTF8ToWString(r.get<std::string>()));
				}
			}
		} else if (res.code == 2) {
			res.userId = j.value("userId", 0);
			res.username = UTF8ToWString(j.value("username", ""));
		}
	} catch (...) {
		res.success = false;
		res.code = 0;
		res.message = L"Error al procesar respuesta del servidor.";
	}
	return res;
}

RegisterResult AniAuthClient::Register(const std::wstring& username, const std::wstring& email, const std::wstring& password, int countryId) {
	RegisterResult res;
	nlohmann::json req;
	req["username"] = WStringToUTF8(username);
	req["email"] = WStringToUTF8(email);
	req["password"] = WStringToUTF8(password);
	req["countryId"] = countryId;

	std::string resp = HttpPost(BASE_AUTH_URL + "/api/register", req.dump());
	if (resp.empty()) {
		res.success = false;
		res.code = 0;
		res.message = L"No se pudo conectar con el servidor.";
		return res;
	}

	try {
		auto j = nlohmann::json::parse(resp);
		res.code = j.value("code", 0);
		res.success = (res.code == 1);
		res.message = UTF8ToWString(j.value("message", ""));
		res.userId = j.value("userId", 0);
	} catch (...) {
		res.success = false;
		res.code = 0;
		res.message = L"Error al procesar respuesta del servidor.";
	}
	return res;
}

bool AniAuthClient::Logout(int userId, const std::string& token) {
	if (userId <= 0) return true;
	nlohmann::json req;
	req["userId"] = userId;
	req["sessionToken"] = token;
	std::string resp = HttpPost(BASE_AUTH_URL + "/api/logout", req.dump(), 3);
	return !resp.empty();
}

bool AniAuthClient::Heartbeat(int userId, const std::string& token) {
	if (userId <= 0 || token.empty()) return false;
	nlohmann::json req;
	req["userId"] = userId;
	req["sessionToken"] = token;
	std::string resp = HttpPost(BASE_AUTH_URL + "/api/heartbeat", req.dump(), 3);
	if (resp.empty()) return false;
	try {
		auto j = nlohmann::json::parse(resp);
		return j.value("validSession", false);
	} catch (...) {
		return false;
	}
}

} // namespace ygo
