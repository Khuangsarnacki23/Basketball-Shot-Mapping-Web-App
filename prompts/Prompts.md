PROMPTS (Assisted with Chat-GPT 5.0 Thinking):

Frontend:

Help me construct a svg model of a half court basketball from a birds eye perspective where coordinates start with (0,0) 4 feet above the base of the court and are positioned 22 feet from the from the corner three. There is approximately at 23.75 feet distance from the 'above the break' three and the end of the corner three starts changing at approximately 8 feet. 

Backend: 

Given the current database structure from [Attached Image for Normalized DB], help me with constructing a migration script. Note, all the given relationships (1 to M), (M to 1) are given in the following diagram along with the primary and foreign keys. Please, use the information of this JSON format to help assist you which directly relate to the rows within the tables. [Attached one player, game and team data point for reference]. 

Help me build a function for the 'action_sections' where each action can either be ["pickAndRoll", "isolation", "postUp", "offBallScreen"], which returns a dictionary of all the "shots" "passes", "turnovers" given a player_id. NOTE: Turnovers do not exist within the pass table and must be constructed from taking a join between the PASS and TURNOVER table based upon pass_id (not null). All three groups are arrays that are constructed based upon the locations of the ball along with extra parameters listed below. [List database structure for shots, passes, turnovers].