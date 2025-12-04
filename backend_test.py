#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import uuid

class SoloLevelingAPITester:
    def __init__(self, base_url="https://solo-level-debug.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_results = []

    def log_test(self, name, success, details="", expected_status=None, actual_status=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
            self.failed_tests.append({
                "test": name,
                "error": details,
                "expected_status": expected_status,
                "actual_status": actual_status
            })
        
        self.test_results.append({
            "test_name": name,
            "status": "PASSED" if success else "FAILED",
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def make_request(self, method, endpoint, data=None, expected_status=200, auth_required=True):
        """Make HTTP request with error handling"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}

            return success, response_data, response.status_code

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, None

    def test_auth_register(self):
        """Test user registration"""
        test_email = f"testuser_{uuid.uuid4().hex[:8]}@hunter.com"
        test_data = {
            "email": test_email,
            "password": "hunter123",
            "hunter_name": f"TestHunter_{uuid.uuid4().hex[:6]}"
        }
        
        success, response, status = self.make_request(
            'POST', 'auth/register', test_data, 200, auth_required=False
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response.get('user_id')
            self.log_test("User Registration", True)
            return True
        else:
            self.log_test("User Registration", False, 
                         f"Status: {status}, Response: {response}", 200, status)
            return False

    def test_auth_login(self):
        """Test user login with existing user"""
        login_data = {
            "email": "shadow@hunter.com",
            "password": "shadow123"  # Assuming this is the password
        }
        
        success, response, status = self.make_request(
            'POST', 'auth/login', login_data, 200, auth_required=False
        )
        
        if success and 'token' in response:
            # Store for later tests if registration failed
            if not self.token:
                self.token = response['token']
                self.user_id = response.get('user_id')
            self.log_test("User Login", True)
            return True
        else:
            self.log_test("User Login", False, 
                         f"Status: {status}, Response: {response}", 200, status)
            return False

    def test_get_profile(self):
        """Test get user profile"""
        success, response, status = self.make_request('GET', 'user/profile', expected_status=200)
        
        if success and 'hunter_name' in response:
            self.log_test("Get User Profile", True)
            return True
        else:
            self.log_test("Get User Profile", False, 
                         f"Status: {status}, Response: {response}", 200, status)
            return False

    def test_daily_quests(self):
        """Test daily quest generation"""
        success, response, status = self.make_request('GET', 'quests/daily', expected_status=200)
        
        if success and 'exercises' in response:
            self.daily_quest_id = response.get('id')
            self.log_test("Daily Quest Generation", True)
            return True
        else:
            self.log_test("Daily Quest Generation", False, 
                         f"Status: {status}, Response: {response}", 200, status)
            return False

    def test_complete_quest(self):
        """Test quest completion"""
        if not hasattr(self, 'daily_quest_id') or not self.daily_quest_id:
            self.log_test("Complete Quest", False, "No daily quest ID available")
            return False
            
        quest_data = {"quest_id": self.daily_quest_id}
        success, response, status = self.make_request(
            'POST', 'quests/complete', quest_data, expected_status=200
        )
        
        if success and 'exp_gained' in response:
            self.log_test("Complete Daily Quest", True)
            return True
        else:
            self.log_test("Complete Daily Quest", False, 
                         f"Status: {status}, Response: {response}", 200, status)
            return False

    def test_fail_quest(self):
        """Test quest failure and punishment"""
        # Get a new daily quest first
        success, response, status = self.make_request('GET', 'quests/daily', expected_status=200)
        if not success:
            self.log_test("Fail Quest Setup", False, "Could not get daily quest")
            return False
            
        quest_data = {"quest_id": response.get('id')}
        success, response, status = self.make_request(
            'POST', 'quests/fail', quest_data, expected_status=200
        )
        
        if success and 'punishment_assigned' in response:
            self.log_test("Fail Quest and Get Punishment", True)
            return True
        else:
            self.log_test("Fail Quest and Get Punishment", False, 
                         f"Status: {status}, Response: {response}", 200, status)
            return False

    def test_special_dungeons(self):
        """Test special dungeons listing"""
        success, response, status = self.make_request('GET', 'quests/special', expected_status=200)
        
        if success and isinstance(response, list):
            self.log_test("Special Dungeons Listing", True)
            return True
        else:
            self.log_test("Special Dungeons Listing", False, 
                         f"Status: {status}, Response: {response}", 200, status)
            return False

    def test_shop_items(self):
        """Test shop items listing"""
        success, response, status = self.make_request('GET', 'shop/items', expected_status=200)
        
        if success and isinstance(response, list) and len(response) > 0:
            self.shop_items = response
            self.log_test("Shop Items Listing", True)
            return True
        else:
            self.log_test("Shop Items Listing", False, 
                         f"Status: {status}, Response: {response}", 200, status)
            return False

    def test_buy_item(self):
        """Test buying item from shop"""
        if not hasattr(self, 'shop_items') or not self.shop_items:
            self.log_test("Buy Shop Item", False, "No shop items available")
            return False
            
        # Try to buy the cheapest item
        cheapest_item = min(self.shop_items, key=lambda x: x['price'])
        buy_data = {"item_id": cheapest_item['id']}
        
        success, response, status = self.make_request(
            'POST', 'shop/buy', buy_data, expected_status=200
        )
        
        if success and 'success' in response:
            self.log_test("Buy Shop Item", True)
            return True
        else:
            # Could fail due to insufficient gold, which is acceptable
            if status == 400 and 'insuficiente' in str(response).lower():
                self.log_test("Buy Shop Item", True, "Failed due to insufficient gold (expected)")
                return True
            else:
                self.log_test("Buy Shop Item", False, 
                             f"Status: {status}, Response: {response}", 200, status)
                return False

    def test_guild_creation(self):
        """Test guild creation"""
        guild_data = {
            "name": f"TestGuild_{uuid.uuid4().hex[:6]}",
            "description": "Test guild for API testing"
        }
        
        success, response, status = self.make_request(
            'POST', 'guilds/create', guild_data, expected_status=200
        )
        
        if success and 'guild_id' in response:
            self.guild_id = response['guild_id']
            self.log_test("Guild Creation", True)
            return True
        else:
            self.log_test("Guild Creation", False, 
                         f"Status: {status}, Response: {response}", 200, status)
            return False

    def test_guild_listing(self):
        """Test guild listing"""
        success, response, status = self.make_request(
            'GET', 'guilds', expected_status=200, auth_required=False
        )
        
        if success and isinstance(response, list):
            self.log_test("Guild Listing", True)
            return True
        else:
            self.log_test("Guild Listing", False, 
                         f"Status: {status}, Response: {response}", 200, status)
            return False

    def test_join_guild(self):
        """Test joining a guild (will fail if already in guild, which is expected)"""
        # First get available guilds
        success, guilds, status = self.make_request(
            'GET', 'guilds', expected_status=200, auth_required=False
        )
        
        if not success or not guilds:
            self.log_test("Join Guild", False, "No guilds available to join")
            return False
            
        # Try to join the first guild
        guild_data = {"guild_id": guilds[0]['id']}
        success, response, status = self.make_request(
            'POST', 'guilds/join', guild_data, expected_status=200
        )
        
        if success:
            self.log_test("Join Guild", True)
            return True
        elif status == 400 and 'ya perteneces' in str(response).lower():
            self.log_test("Join Guild", True, "Already in guild (expected)")
            return True
        else:
            self.log_test("Join Guild", False, 
                         f"Status: {status}, Response: {response}", 200, status)
            return False

    def test_player_ranking(self):
        """Test player ranking"""
        success, response, status = self.make_request(
            'GET', 'ranking', expected_status=200, auth_required=False
        )
        
        if success and isinstance(response, list):
            self.log_test("Player Ranking", True)
            return True
        else:
            self.log_test("Player Ranking", False, 
                         f"Status: {status}, Response: {response}", 200, status)
            return False

    def test_guild_ranking(self):
        """Test guild ranking"""
        success, response, status = self.make_request(
            'GET', 'ranking/guilds', expected_status=200, auth_required=False
        )
        
        if success and isinstance(response, list):
            self.log_test("Guild Ranking", True)
            return True
        else:
            self.log_test("Guild Ranking", False, 
                         f"Status: {status}, Response: {response}", 200, status)
            return False

    def test_achievements(self):
        """Test achievements listing"""
        success, response, status = self.make_request('GET', 'achievements', expected_status=200)
        
        if success and isinstance(response, list):
            self.log_test("Achievements Listing", True)
            return True
        else:
            self.log_test("Achievements Listing", False, 
                         f"Status: {status}, Response: {response}", 200, status)
            return False

    def test_stat_upgrade(self):
        """Test stat upgrade"""
        stat_data = {"stat_name": "strength", "points": 1}
        success, response, status = self.make_request(
            'POST', 'user/upgrade-stat', stat_data, expected_status=200
        )
        
        if success and 'success' in response:
            self.log_test("Stat Upgrade", True)
            return True
        elif status == 400 and 'suficientes puntos' in str(response).lower():
            self.log_test("Stat Upgrade", True, "No stat points available (expected)")
            return True
        else:
            self.log_test("Stat Upgrade", False, 
                         f"Status: {status}, Response: {response}", 200, status)
            return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Solo Leveling API Tests...")
        print(f"🎯 Testing against: {self.base_url}")
        print("=" * 60)

        # Authentication tests
        print("\n📋 Authentication Tests:")
        self.test_auth_register()
        self.test_auth_login()
        
        if not self.token:
            print("❌ Cannot continue without authentication token")
            return False

        # User profile tests
        print("\n👤 User Profile Tests:")
        self.test_get_profile()

        # Quest tests
        print("\n⚔️ Quest Tests:")
        self.test_daily_quests()
        self.test_complete_quest()
        self.test_fail_quest()
        self.test_special_dungeons()

        # Shop tests
        print("\n🛒 Shop Tests:")
        self.test_shop_items()
        self.test_buy_item()

        # Guild tests
        print("\n🏰 Guild Tests:")
        self.test_guild_creation()
        self.test_guild_listing()
        self.test_join_guild()

        # Ranking tests
        print("\n🏆 Ranking Tests:")
        self.test_player_ranking()
        self.test_guild_ranking()

        # Achievement tests
        print("\n🎖️ Achievement Tests:")
        self.test_achievements()

        # Stat tests
        print("\n📊 Stat Tests:")
        self.test_stat_upgrade()

        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary:")
        print(f"✅ Passed: {self.tests_passed}/{self.tests_run}")
        print(f"❌ Failed: {len(self.failed_tests)}/{self.tests_run}")
        print(f"📈 Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")

        if self.failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"  • {test['test']}: {test['error']}")

        return len(self.failed_tests) == 0

def main():
    tester = SoloLevelingAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    results = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": tester.tests_run,
        "passed_tests": tester.tests_passed,
        "failed_tests": len(tester.failed_tests),
        "success_rate": (tester.tests_passed/tester.tests_run)*100 if tester.tests_run > 0 else 0,
        "test_details": tester.test_results,
        "failed_test_details": tester.failed_tests
    }
    
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())